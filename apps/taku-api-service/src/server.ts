import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { Logger } from "pino";
import type { AppConfig } from "./config.js";
import { ensureServiceAccess } from "./auth.js";
import { createV1Router } from "./routes.js";
import { TakuStore } from "./store.js";
import { WaServiceClient } from "./waServiceClient.js";

export function createServer(params: {
  config: AppConfig;
  logger: Logger;
}): Express {
  const app = express();
  const store = new TakuStore(params.config.dataFile);
  const waServiceClient = new WaServiceClient(params.config);

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin && params.config.allowedOrigins.includes(origin)) {
      res.header("access-control-allow-origin", origin);
      res.header("vary", "Origin");
      res.header("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");
      res.header(
        "access-control-allow-headers",
        "authorization,content-type,x-api-key,x-taku-role,x-taku-business-id,x-taku-status-password",
      );
    }

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "taku-api-service" });
  });

  app.use((req, res, next) => {
    if (!ensureServiceAccess(req, res, params.config)) return;
    next();
  });

  app.use(
    "/v1",
    createV1Router({ config: params.config, store, waServiceClient }),
  );

  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      params.logger.error({ err: error }, "request failed");
      res.status(500).json({ ok: false, error: "Internal error" });
    },
  );

  return app;
}
