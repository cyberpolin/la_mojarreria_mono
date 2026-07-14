import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

loadDotenv({ path: resolve(process.cwd(), ".env") });

function stringValue(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function numberValue(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number`);
  }
  return value;
}

function stringList(name: string, fallback: string[]): string[] {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  environment: stringValue(
    "TAKU_BACKEND_ENV",
    process.env.NODE_ENV ?? "development",
  ),
  host: stringValue("HOST", "0.0.0.0"),
  port: numberValue("PORT", 4000),
  dataFile: stringValue("TAKU_BACKEND_DATA_FILE", "./data/taku-backend.json"),
  jwtSecret: stringValue(
    "TAKU_BACKEND_JWT_SECRET",
    "dev-only-change-taku-backend-jwt-secret",
  ),
  adminJwtSecret: stringValue(
    "TAKU_BACKEND_ADMIN_JWT_SECRET",
    process.env.TAKU_BACKEND_JWT_SECRET ??
      "dev-only-change-taku-admin-jwt-secret",
  ),
  refreshSecret: stringValue(
    "TAKU_BACKEND_REFRESH_SECRET",
    "dev-only-change-taku-backend-refresh-secret",
  ),
  adminRefreshSecret: stringValue(
    "TAKU_BACKEND_ADMIN_REFRESH_SECRET",
    process.env.TAKU_BACKEND_REFRESH_SECRET ??
      "dev-only-change-taku-admin-refresh-secret",
  ),
  allowedOrigins: stringList("TAKU_BACKEND_ALLOWED_ORIGINS", [
    "http://localhost:3006",
    "http://localhost:3003",
  ]),
  takuWaBaseUrl: stringValue("TAKU_WA_BASE_URL", "https://api.wa.taku.lat"),
  takuWaApiKey: process.env.TAKU_WA_API_KEY?.trim() ?? "",
  takuWaWebhookSecret:
    process.env.TAKU_WA_WEBHOOK_SECRET?.trim() ?? "dev-wa-webhook-secret",
  botServiceBaseUrl: stringValue(
    "BOT_SERVICE_BASE_URL",
    "https://bot.taku.lat",
  ),
  botServiceApiKey: process.env.BOT_SERVICE_API_KEY?.trim() ?? "",
  botServiceWebhookSecret:
    process.env.BOT_SERVICE_WEBHOOK_SECRET?.trim() ?? "dev-bot-webhook-secret",
} as const;

export const isDemoSeedEnvironment =
  config.environment.toLowerCase() === "development" ||
  config.environment.toLowerCase() === "test" ||
  config.environment.toUpperCase() === "TEST";
