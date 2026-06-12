import express, { type Express } from "express";
import type { Logger } from "pino";
import type { AppConfig } from "./config.js";
import type { WhatsAppClient } from "./baileys/client.js";
import { createMessagesRouter } from "./routes/messages.js";
import { createServiceRouter } from "./routes/service.js";
import { createV1Router } from "./routes/v1.js";
import { createWhatsAppRouter } from "./routes/whatsapp.js";
import {
  listDebugLogs,
  renderDebugLogsPage,
  subscribeDebugLogs,
} from "./services/debugLogStore.js";
import {
  listReceivedMessageLogs,
  renderReceivedMessageLogsPage,
  subscribeReceivedMessageLogs,
} from "./services/receivedMessageLogStore.js";
import { getAuthHealth } from "./services/authHealth.js";
import {
  getDomainFromRequestOrigin,
  isAllowedRequestDomain,
} from "./utils/requestAuth.js";
import { getSessionIssue } from "./services/sessionIssueStore.js";

export function createServer(params: {
  config: AppConfig;
  logger: Logger;
  whatsAppClient: WhatsAppClient;
}): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.header("origin");
    const originDomain = origin ? getDomainFromRequestOrigin(origin) : null;
    const allowedOrigin =
      originDomain !== null &&
      isAllowedRequestDomain(originDomain, params.config.serviceAllowedDomains);

    if (origin) {
      const logPayload = {
        origin,
        originDomain,
        allowedOrigin,
        allowedDomains: params.config.serviceAllowedDomains,
      };

      if (allowedOrigin) {
        params.logger.info(logPayload, "CORS origin allowed");
      } else {
        params.logger.warn(logPayload, "CORS origin blocked");
      }
    }

    if (origin && allowedOrigin) {
      res.header("access-control-allow-origin", origin);
      res.header("vary", "Origin");
      res.header("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
      res.header(
        "access-control-allow-headers",
        "content-type,x-api-key,x-client-domain",
      );
    }

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", async (_req, res) => {
    res.json({
      ok: true,
      status: params.whatsAppClient.getStatus(),
      auth: await getAuthHealth(params.config.whatsappAuthDir),
      sessionIssue: getSessionIssue(),
    });
  });

  app.get("/debug/logs", (req, res) => {
    res.type("html").send(renderDebugLogsPage("wa-service logs"));
  });

  app.get("/debug/logs/recent", (req, res) => {
    res.json({ ok: true, logs: listDebugLogs() });
  });

  app.get("/debug/logs/events", (req, res) => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const unsubscribe = subscribeDebugLogs((entry) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    });

    req.on("close", unsubscribe);
  });

  app.get("/debug/received-messages", (_req, res) => {
    res.type("html").send(renderReceivedMessageLogsPage());
  });

  app.get("/debug/received-messages/recent", (_req, res) => {
    res.json({ ok: true, logs: listReceivedMessageLogs() });
  });

  app.get("/debug/received-messages/events", (req, res) => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const unsubscribe = subscribeReceivedMessageLogs((entry) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    });

    req.on("close", unsubscribe);
  });

  app.use(
    "/v1",
    createV1Router({
      config: params.config,
      whatsAppClient: params.whatsAppClient,
    }),
  );

  app.use(
    "/messages",
    createMessagesRouter({
      config: params.config,
      logger: params.logger,
      whatsAppClient: params.whatsAppClient,
    }),
  );

  app.use(
    "/service",
    createServiceRouter({
      config: params.config,
      logger: params.logger,
      whatsAppClient: params.whatsAppClient,
    }),
  );

  app.use(
    "/whatsapp",
    createWhatsAppRouter({
      config: params.config,
      whatsAppClient: params.whatsAppClient,
    }),
  );

  return app;
}
