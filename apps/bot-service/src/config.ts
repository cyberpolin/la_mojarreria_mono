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

const optionalStringArray = (name: string, fallback: string[]): string[] => {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : fallback;
};

const optionalPercentage = (name: string, fallback: number): number => {
  const value = optionalNumber(name, fallback);
  if (value < 0) {
    throw new Error(`${name} must be greater than or equal to 0`);
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
  botModels: optionalStringArray("BOT_MODELS", ["taku-cr"]),
  deepseekTemperature: optionalNumber("DEEPSEEK_TEMPERATURE", 0.2),
  deepseekMaxTokens: optionalNumber("DEEPSEEK_MAX_TOKENS", 300),
  instructionsFile:
    process.env.BOT_INSTRUCTIONS_FILE?.trim() ?? "./data/instructions.json",
  assistantsFile:
    process.env.BOT_ASSISTANTS_FILE?.trim() ?? "./data/assistants.json",
  paymentIntentsFile:
    process.env.BOT_PAYMENT_INTENTS_FILE?.trim() ??
    "./data/payment-intents.json",
  usageFile: process.env.BOT_USAGE_FILE?.trim() ?? "./data/usage.json",
  billingAccountsFile:
    process.env.BOT_BILLING_ACCOUNTS_FILE?.trim() ??
    "./data/billing-accounts.json",
  processedMessagesFile:
    process.env.BOT_PROCESSED_MESSAGES_FILE?.trim() ??
    "./data/processed-messages.json",
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || null,
  mercadoPagoCurrencyId: process.env.MERCADOPAGO_CURRENCY_ID?.trim() || "USD",
  deepseekInputCacheMissUsdPerMillion: optionalNumber(
    "DEEPSEEK_INPUT_CACHE_MISS_USD_PER_1M",
    0.14,
  ),
  deepseekOutputUsdPerMillion: optionalNumber(
    "DEEPSEEK_OUTPUT_USD_PER_1M",
    0.28,
  ),
  botServiceChargeMarkupPercent: optionalPercentage(
    "BOT_SERVICE_CHARGE_MARKUP_PERCENT",
    20,
  ),
  botFreeMonthlyIncludedUsd: optionalNumber("BOT_FREE_MONTHLY_INCLUDED_USD", 2),
  botFreeMarkupPercent: optionalPercentage("BOT_FREE_MARKUP_PERCENT", 20),
  botOnDemandMinPrepaidUsd: optionalNumber("BOT_ON_DEMAND_MIN_PREPAID_USD", 5),
  botOnDemandMarkupPercent: optionalPercentage(
    "BOT_ON_DEMAND_MARKUP_PERCENT",
    20,
  ),
  botHighUsageMinPrepaidUsd: optionalNumber(
    "BOT_HIGH_USAGE_MIN_PREPAID_USD",
    20,
  ),
  botHighUsageMarkupPercent: optionalPercentage(
    "BOT_HIGH_USAGE_MARKUP_PERCENT",
    10,
  ),
  botLowBalanceWarningThresholdPercent: optionalPercentage(
    "BOT_LOW_BALANCE_WARNING_THRESHOLD_PERCENT",
    10,
  ),
} as const;
