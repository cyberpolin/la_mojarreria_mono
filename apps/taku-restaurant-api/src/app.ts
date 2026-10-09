import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler } from "./middleware.js";
import { createApiRouter } from "./routes.js";
import type { JsonStore } from "./store.js";

export function createApp(store: JsonStore) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      service: "taku-restaurant-api",
      apiBasePath: "/api",
      health: "/api/health",
    });
  });
  app.use("/api", createApiRouter(store));
  app.use(errorHandler);
  return app;
}
