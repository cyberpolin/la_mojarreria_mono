import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: [
      "accessToken",
      "pageAccessToken",
      "req.headers.authorization",
      "req.headers.x-api-key",
      "req.headers['x-fb-service-secret']",
      "webhookSecret",
    ],
    remove: true,
  },
});
