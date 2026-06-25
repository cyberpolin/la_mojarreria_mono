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
  PORT: z.coerce.number().int().positive().default(3001),
  SERVICE_API_KEY: z.string().min(1, "SERVICE_API_KEY is required"),
  SERVICE_ALLOWED_DOMAINS: z
    .string()
    .min(1)
    .default("lamojarreria.com,taku.lat,localhost,127.0.0.1"),
  MAIN_BACKEND_URL: z.string().url("MAIN_BACKEND_URL must be a valid URL"),
  MAIN_BACKEND_WEBHOOK_SECRET: z
    .string()
    .min(1, "MAIN_BACKEND_WEBHOOK_SECRET is required"),
  WA_SERVICE_AUTO_START: z.enum(["true", "false", "1", "0"]).default("false"),
  WHATSAPP_AUTH_DIR: z.string().min(1).default("./auth"),
  WHATSAPP_AUTH_ROOT: z.string().min(1).default("./data/auth"),
  CONNECTION_STORE_FILE: z.string().min(1).default("./data/connections.json"),
  CONNECTION_DATA_ROOT: z.string().min(1).default("./data/connections"),
  REGISTRY_STORE_FILE: z.string().min(1).default("./data/registrations.json"),
  INBOUND_CONTACTS_STORE_FILE: z
    .string()
    .min(1)
    .default("./data/inbound-contacts.json"),
  CONVERSATION_STORE_FILE: z
    .string()
    .min(1)
    .default("./data/conversations.json"),
  WEBHOOK_SUBSCRIPTIONS_FILE: z
    .string()
    .min(1)
    .default("./data/webhook-subscriptions.json"),
  STANDALONE_ACCOUNTS_FILE: z
    .string()
    .min(1)
    .default("./data/standalone-accounts.json"),
  AUTORESPONSE_TEST_PHONES_FILE: z
    .string()
    .min(1)
    .default("./data/autoresponse-test-phones.json"),
  DUMMY_REGISTRY_API_URL: z.string().url().optional().or(z.literal("")),
  BOT_SERVICE_BASE_URL: z.string().url().default("http://127.0.0.1:3002"),
  BOT_SERVICE_API_KEY: z.string().optional().or(z.literal("")),
  TAKU_API_BASE_URL: z.string().url().default("http://127.0.0.1:3010"),
  TAKU_API_KEY: z.string().optional().or(z.literal("")),
  TAKU_API_BUSINESS_ID: z.string().trim().default("business_001"),
  TAKU_WA_WEB_BASE_URL: z.string().url().default("http://localhost:3004"),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional().or(z.literal("")),
  MERCADOPAGO_PUBLIC_KEY: z.string().optional().or(z.literal("")),
  MERCADOPAGO_CURRENCY_ID: z.string().trim().min(3).max(3).default("MXN"),
  MERCADOPAGO_NOTIFICATION_URL: z.string().url().optional().or(z.literal("")),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
});

const env = envSchema.parse(process.env);

export const config = {
  port: env.PORT,
  serviceApiKey: env.SERVICE_API_KEY,
  serviceAllowedDomains: env.SERVICE_ALLOWED_DOMAINS.split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean),
  mainBackendUrl: env.MAIN_BACKEND_URL.replace(/\/+$/, ""),
  mainBackendWebhookSecret: env.MAIN_BACKEND_WEBHOOK_SECRET,
  waServiceAutoStart:
    env.WA_SERVICE_AUTO_START === "true" || env.WA_SERVICE_AUTO_START === "1",
  whatsappAuthDir: resolveServicePath(env.WHATSAPP_AUTH_DIR),
  whatsappAuthRoot: resolveServicePath(env.WHATSAPP_AUTH_ROOT),
  connectionStoreFile: resolveServicePath(env.CONNECTION_STORE_FILE),
  connectionDataRoot: resolveServicePath(env.CONNECTION_DATA_ROOT),
  registryStoreFile: resolveServicePath(env.REGISTRY_STORE_FILE),
  inboundContactsStoreFile: resolveServicePath(env.INBOUND_CONTACTS_STORE_FILE),
  conversationStoreFile: resolveServicePath(env.CONVERSATION_STORE_FILE),
  webhookSubscriptionsFile: resolveServicePath(env.WEBHOOK_SUBSCRIPTIONS_FILE),
  standaloneAccountsFile: resolveServicePath(env.STANDALONE_ACCOUNTS_FILE),
  autoresponseTestPhonesFile: resolveServicePath(
    env.AUTORESPONSE_TEST_PHONES_FILE,
  ),
  dummyRegistryApiUrl: env.DUMMY_REGISTRY_API_URL
    ? env.DUMMY_REGISTRY_API_URL.replace(/\/+$/, "")
    : null,
  botServiceBaseUrl: env.BOT_SERVICE_BASE_URL.replace(/\/+$/, ""),
  botServiceApiKey: env.BOT_SERVICE_API_KEY || null,
  takuApiBaseUrl: env.TAKU_API_BASE_URL.replace(/\/+$/, ""),
  takuApiKey: env.TAKU_API_KEY || null,
  takuApiBusinessId: env.TAKU_API_BUSINESS_ID,
  takuWaWebBaseUrl: env.TAKU_WA_WEB_BASE_URL.replace(/\/+$/, ""),
  mercadoPagoAccessToken: env.MERCADOPAGO_ACCESS_TOKEN || null,
  mercadoPagoPublicKey: env.MERCADOPAGO_PUBLIC_KEY || null,
  mercadoPagoCurrencyId: env.MERCADOPAGO_CURRENCY_ID,
  mercadoPagoNotificationUrl: env.MERCADOPAGO_NOTIFICATION_URL
    ? env.MERCADOPAGO_NOTIFICATION_URL
    : null,
  mercadoPagoWebhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET || null,
} as const;

export type AppConfig = typeof config;
