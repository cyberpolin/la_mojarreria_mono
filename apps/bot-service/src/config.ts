import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(currentDir, "../.env") });

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const optionalNumber = (name: string, fallback: number): number => {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number`);
  }

  return value;
};

export const config = {
  host: process.env.HOST?.trim() || "0.0.0.0",
  port: Number(process.env.PORT ?? 3002),
  apiKey: required("BOT_SERVICE_API_KEY"),
  deepseekApiKey: required("DEEPSEEK_API_KEY"),
  deepseekBaseUrl:
    process.env.DEEPSEEK_BASE_URL?.trim().replace(/\/+$/, "") ||
    "https://api.deepseek.com",
  deepseekModel: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
  deepseekTemperature: optionalNumber("DEEPSEEK_TEMPERATURE", 0.2),
  deepseekMaxTokens: optionalNumber("DEEPSEEK_MAX_TOKENS", 300),
  instructionsFile:
    process.env.BOT_INSTRUCTIONS_FILE?.trim() ?? "./data/instructions.json",
  processedMessagesFile:
    process.env.BOT_PROCESSED_MESSAGES_FILE?.trim() ??
    "./data/processed-messages.json",
} as const;
