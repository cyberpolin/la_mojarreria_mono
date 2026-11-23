import express, { type Express, type Request } from "express";
import type { Logger } from "pino";
import type { AppConfig } from "./config.js";
import { GraphRequestError } from "./meta/graphClient.js";
import { createMetaWebhookRouter } from "./routes/metaWebhook.js";
import { createV1Router } from "./routes/v1.js";

type RequestWithRawBody = Request & { rawBody?: Buffer };

export function createServer(params: {
  config: AppConfig;
  logger: Logger;
}): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buffer) => {
        (req as RequestWithRawBody).rawBody = Buffer.from(buffer);
      },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "fb-service",
      replyMode: params.config.replyMode,
      backendConfigured: Boolean(
        params.config.takuBackendUrl && params.config.takuBackendWebhookSecret,
      ),
    });
  });

  app.use(
    "/webhooks/facebook",
    createMetaWebhookRouter({
      config: params.config,
      logger: params.logger,
    }),
  );
  app.use(
    "/v1",
    createV1Router({
      config: params.config,
      logger: params.logger,
    }),
  );

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof SyntaxError) {
        res.status(400).json({ ok: false, error: "Invalid JSON" });
        return;
      }

      params.logger.error(
        {
          err: error instanceof Error ? error.message : "request_failed",
          graphStatus: error instanceof GraphRequestError ? error.status : null,
          graphMessage:
            error instanceof GraphRequestError ? error.graphMessage : null,
        },
        "facebook service request failed",
      );

      if (error instanceof GraphRequestError) {
        res.status(502).json({
          ok: false,
          error: error.graphMessage ?? "Facebook request failed",
        });
        return;
      }

      res.status(500).json({ ok: false, error: "Request failed" });
    },
  );

  return app;
}
