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

const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3011),
    SERVICE_API_KEY: z.string().trim().min(8, "SERVICE_API_KEY is required"),
    FACEBOOK_VERIFY_TOKEN: z
      .string()
      .trim()
      .min(1, "FACEBOOK_VERIFY_TOKEN is required"),
    FACEBOOK_APP_SECRET: z.string().trim().optional().or(z.literal("")),
    FACEBOOK_SKIP_SIGNATURE_CHECK: z.enum(["true", "false"]).default("false"),
    GRAPH_API_VERSION: z
      .string()
      .trim()
      .regex(/^v\d+\.\d+$/, "GRAPH_API_VERSION must look like v21.0")
      .default("v21.0"),
    REPLY_MODE: z.enum(["local", "backend"]).default("local"),
    TAKU_BACKEND_URL: z.string().trim().url().optional().or(z.literal("")),
    TAKU_BACKEND_WEBHOOK_SECRET: z.string().trim().optional().or(z.literal("")),
    TAKU_BACKEND_WEBHOOK_PATH: z
      .string()
      .trim()
      .regex(/^\//, "TAKU_BACKEND_WEBHOOK_PATH must start with /")
      .default("/api/webhooks/facebook"),
    PAGES_FILE: z.string().min(1).default("./data/pages.json"),
    PUBLICATION_RULES_FILE: z
      .string()
      .min(1)
      .default("./data/publication-rules.json"),
    PROCESSED_EVENTS_FILE: z
      .string()
      .min(1)
      .default("./data/processed-events.json"),
    EVENT_LOG_FILE: z.string().min(1).default("./data/event-log.json"),
    LOG_LEVEL: z.string().trim().min(1).default("info"),
  })
  .superRefine((value, context) => {
    if (value.REPLY_MODE !== "backend") {
      return;
    }

    if (!value.TAKU_BACKEND_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TAKU_BACKEND_URL"],
        message: "TAKU_BACKEND_URL is required when REPLY_MODE=backend",
      });
    }

    if (!value.TAKU_BACKEND_WEBHOOK_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TAKU_BACKEND_WEBHOOK_SECRET"],
        message:
          "TAKU_BACKEND_WEBHOOK_SECRET is required when REPLY_MODE=backend",
      });
    }
  });

const env = envSchema.parse(process.env);

export const config = {
  port: env.PORT,
  serviceApiKey: env.SERVICE_API_KEY,
  facebookVerifyToken: env.FACEBOOK_VERIFY_TOKEN,
  facebookAppSecret: env.FACEBOOK_APP_SECRET || null,
  facebookSkipSignatureCheck: env.FACEBOOK_SKIP_SIGNATURE_CHECK === "true",
  graphApiVersion: env.GRAPH_API_VERSION,
  replyMode: env.REPLY_MODE,
  takuBackendUrl: env.TAKU_BACKEND_URL
    ? env.TAKU_BACKEND_URL.replace(/\/+$/, "")
    : null,
  takuBackendWebhookSecret: env.TAKU_BACKEND_WEBHOOK_SECRET || null,
  takuBackendWebhookPath: env.TAKU_BACKEND_WEBHOOK_PATH,
  pagesFile: resolveServicePath(env.PAGES_FILE),
  publicationRulesFile: resolveServicePath(env.PUBLICATION_RULES_FILE),
  processedEventsFile: resolveServicePath(env.PROCESSED_EVENTS_FILE),
  eventLogFile: resolveServicePath(env.EVENT_LOG_FILE),
  logLevel: env.LOG_LEVEL,
} as const;

export type AppConfig = typeof config;
