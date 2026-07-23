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

function booleanValue(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name]?.trim().toLowerCase();
  if (!rawValue) return fallback;
  if (["1", "true", "yes", "on"].includes(rawValue)) return true;
  if (["0", "false", "no", "off"].includes(rawValue)) return false;
  throw new Error(`${name} must be a boolean`);
}

function nonNegativeNumberValue(name: string, fallback: number): number {
  const value = numberValue(name, fallback);
  if (value < 0) {
    throw new Error(`${name} must be greater than or equal to 0`);
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

function serviceUrlValue(name: string, fallback: string): string {
  const value = stringValue(name, fallback).replace(/\/+$/, "");
  if (value === "https://bot.api.taku.lat") {
    console.warn(
      `${name}=https://bot.api.taku.lat is deprecated; using https://api.bot.taku.lat`,
    );
    return "https://api.bot.taku.lat";
  }
  return value;
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
  superAdminEmail: stringValue(
    "TAKU_BACKEND_SUPERADMIN_EMAIL",
    process.env.SUPERADMIN_EMAIL?.trim() || "cyberpolin@gmail.com",
  ),
  superAdminPassword: stringValue(
    "TAKU_BACKEND_SUPERADMIN_PASSWORD",
    process.env.SUPERADMIN_PASSWORD?.trim() || "changeme",
  ),
  allowedOrigins: stringList("TAKU_BACKEND_ALLOWED_ORIGINS", [
    "http://localhost:3006",
    "http://localhost:3003",
  ]),
  publicBaseUrl: stringValue(
    "TAKU_BACKEND_PUBLIC_BASE_URL",
    "https://api.taku.lat/api",
  ),
  takuWaBaseUrl: serviceUrlValue("TAKU_WA_BASE_URL", "https://api.wa.taku.lat"),
  takuWaApiKey: process.env.TAKU_WA_API_KEY?.trim() ?? "",
  takuWaClientDomain: stringValue("TAKU_WA_CLIENT_DOMAIN", "taku.lat"),
  takuWaWebhookSecret:
    process.env.TAKU_WA_WEBHOOK_SECRET?.trim() ?? "dev-wa-webhook-secret",
  botServiceBaseUrl: serviceUrlValue(
    "BOT_SERVICE_BASE_URL",
    "https://api.bot.taku.lat",
  ),
  botServiceApiKey: process.env.BOT_SERVICE_API_KEY?.trim() ?? "",
  botServiceWebhookSecret:
    process.env.BOT_SERVICE_WEBHOOK_SECRET?.trim() ?? "dev-bot-webhook-secret",
  automationReplyMinDelayMs: nonNegativeNumberValue(
    "TAKU_AUTOMATION_REPLY_MIN_DELAY_MS",
    2_000,
  ),
  automationReplyMaxDelayMs: nonNegativeNumberValue(
    "TAKU_AUTOMATION_REPLY_MAX_DELAY_MS",
    35_000,
  ),
  automationReplyFastInboundWindowMs: nonNegativeNumberValue(
    "TAKU_AUTOMATION_REPLY_FAST_INBOUND_WINDOW_MS",
    10_000,
  ),
  automationReplySlowInboundWindowMs: nonNegativeNumberValue(
    "TAKU_AUTOMATION_REPLY_SLOW_INBOUND_WINDOW_MS",
    120_000,
  ),
  botResponderDetectionEnabled: booleanValue(
    "TAKU_BOT_RESPONDER_DETECTION_ENABLED",
    true,
  ),
  botResponderScoreThresholdPercent: nonNegativeNumberValue(
    "TAKU_BOT_RESPONDER_SCORE_THRESHOLD_PERCENT",
    75,
  ),
  botResponderProbeCooldownMs: nonNegativeNumberValue(
    "TAKU_BOT_RESPONDER_PROBE_COOLDOWN_MS",
    6 * 60 * 60 * 1000,
  ),
} as const;

export const isDemoSeedEnvironment =
  config.environment.toLowerCase() === "development" ||
  config.environment.toLowerCase() === "test" ||
  config.environment.toUpperCase() === "TEST";
