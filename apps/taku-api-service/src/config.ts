import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));
const serviceRoot = resolve(currentDir, "..");
loadDotenv({ path: resolve(serviceRoot, ".env") });

function resolveServicePath(path: string): string {
  return isAbsolute(path) ? path : resolve(serviceRoot, path);
}

const envSchema = z.object({
  TAKU_API_PORT: z.coerce.number().int().positive().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  TAKU_DATA_FILE: z.string().trim().min(1).default("./data/taku-api.json"),
  TAKU_ALLOWED_ORIGINS: z.string().trim().default("http://localhost:3003"),
  TAKU_API_KEY: z.string().trim().optional().or(z.literal("")),
  TAKU_SESSION_SECRET: z
    .string()
    .trim()
    .min(16)
    .default("taku-local-session-secret"),
  TAKU_SUPEROWNER_EMAIL: z
    .string()
    .trim()
    .email()
    .default("superowner@taku.local"),
  TAKU_SUPEROWNER_PASSWORD: z.string().trim().min(1).default("superowner"),
  TAKU_CLIENT_PASSWORD: z.string().trim().min(1).default("client"),
  WA_SERVICE_BASE_URL: z.string().url().default("http://localhost:3001"),
  WA_SERVICE_API_KEY: z.string().trim().optional().or(z.literal("")),
  WA_SERVICE_CLIENT_DOMAIN: z.string().trim().default("localhost"),
  TAKU_WEB_BASE_URL: z.string().url().default("http://localhost:3003"),
  MERCADOPAGO_ACCESS_TOKEN: z.string().trim().optional().or(z.literal("")),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().trim().optional().or(z.literal("")),
  MERCADOPAGO_USE_SANDBOX: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

const env = envSchema.parse(process.env);

export const config = {
  port: env.TAKU_API_PORT ?? env.PORT ?? 3010,
  host: env.HOST,
  dataFile: resolveServicePath(env.TAKU_DATA_FILE),
  allowedOrigins: env.TAKU_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  apiKey: env.TAKU_API_KEY || null,
  sessionSecret: env.TAKU_SESSION_SECRET,
  superownerEmail: env.TAKU_SUPEROWNER_EMAIL,
  superownerPassword: env.TAKU_SUPEROWNER_PASSWORD,
  clientPassword: env.TAKU_CLIENT_PASSWORD,
  waServiceBaseUrl: env.WA_SERVICE_BASE_URL.replace(/\/+$/, ""),
  waServiceApiKey: env.WA_SERVICE_API_KEY || null,
  waServiceClientDomain: env.WA_SERVICE_CLIENT_DOMAIN,
  takuWebBaseUrl: env.TAKU_WEB_BASE_URL.replace(/\/+$/, ""),
  mercadoPagoAccessToken: env.MERCADOPAGO_ACCESS_TOKEN || null,
  mercadoPagoWebhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET || null,
  mercadoPagoUseSandbox: env.MERCADOPAGO_USE_SANDBOX,
} as const;

export type AppConfig = typeof config;
