import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler } from "./middleware.js";
import { createApiRouter } from "./routes.js";
import type { Realtime } from "./realtime.js";
import type { JsonStore } from "./store/jsonStore.js";

export function createApp(store: JsonStore, realtime: Realtime) {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: config.allowedOrigins,
      credentials: true,
      allowedHeaders: [
        "authorization",
        "content-type",
        "x-workspace-id",
        "x-signature",
        "x-timestamp",
        "x-taku-status-password",
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      service: "taku-backend",
      apiBasePath: "/api",
      health: "/api/health",
    });
  });
  app.use("/api", createApiRouter(store, realtime));
  app.use(errorHandler);

  return app;
}
