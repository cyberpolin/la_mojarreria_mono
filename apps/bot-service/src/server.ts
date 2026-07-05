import { createServer, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import type { config as appConfig } from "./config.js";
import {
  createDeepSeekChatReply,
  createDeepSeekReply,
  DeepSeekInvalidResponseError,
  DeepSeekProviderError,
  type ChatMessage,
} from "./deepseekClient.js";
import { readRequestJson, sendJson, type JsonResponse } from "./http.js";
import { getInstructions, saveInstructions } from "./instructionsStore.js";
import {
  hasProcessedMessage,
  recordProcessedMessage,
} from "./processedMessagesStore.js";
import {
  listDebugLogs,
  recordDebugLog,
  sendDebugLogsPage,
  subscribeDebugLogs,
} from "./debugLogStore.js";
import {
  createAssistant,
  getAssistant,
  listAssistants,
  updateAssistant,
} from "./assistantsStore.js";
import {
  completeBotPaymentIntent,
  createBotPaymentIntent,
  getBotPaymentIntent,
  isBotPaymentPlan,
  listBotPaymentIntents,
  type BotPaymentPlan,
  type BotPaymentPlanDetails,
} from "./paymentIntentStore.js";
import {
  createMercadoPagoCardPayment,
  findMercadoPagoPaymentByExternalReference,
  getMercadoPagoPayment,
  MercadoPagoRequestError,
} from "./mercadoPagoClient.js";
import {
  getUsageSummary,
  listUsageEvents,
  recordUsageEvent,
  type UsagePricing,
} from "./usageStore.js";
import {
  creditPrepaidBillingAccount,
  debitBillingAccount,
  getBillingAllowance,
  getOrCreateBillingAccount,
  listBillingAccounts,
  type BotBillingAccount,
  type BotBillingRules,
} from "./billingAccountStore.js";

type AppConfig = typeof appConfig;

function getBillingRules(config: AppConfig): BotBillingRules {
  return {
    freeMonthlyIncludedUsd: config.botFreeMonthlyIncludedUsd,
    freeMarkupPercent: config.botFreeMarkupPercent,
    onDemandMarkupPercent: config.botOnDemandMarkupPercent,
    highUsageMarkupPercent: config.botHighUsageMarkupPercent,
  };
}

function getUsagePricing(
  config: AppConfig,
  account?: BotBillingAccount | null,
): UsagePricing {
  return {
    inputCacheMissUsdPerMillion: config.deepseekInputCacheMissUsdPerMillion,
    outputUsdPerMillion: config.deepseekOutputUsdPerMillion,
    markupPercent:
      account?.markupPercent ?? config.botServiceChargeMarkupPercent,
  };
}

function getConfiguredBotPaymentPlan(
  config: AppConfig,
  plan: BotPaymentPlan,
): BotPaymentPlanDetails {
  return plan === "on_demand"
    ? {
        amountUsd: config.botOnDemandMinPrepaidUsd,
        name: "On demand prepaid",
      }
    : {
        amountUsd: config.botHighUsageMinPrepaidUsd,
        name: "High usage prepaid",
      };
}

function buildBillingStatus(account: BotBillingAccount, config: AppConfig) {
  const allowance = getBillingAllowance(account);
  const remainingUsd =
    account.tier === "free"
      ? allowance.includedRemainingUsd
      : allowance.prepaidRemainingUsd;
  const limitUsd =
    account.tier === "free"
      ? account.monthlyIncludedUsd
      : account.prepaidBalanceUsd;
  const usedUsd =
    account.tier === "free"
      ? account.monthlyIncludedUsedUsd
      : Math.max(0, limitUsd - remainingUsd);
  const remainingPercent =
    limitUsd > 0
      ? Math.max(0, Math.min(100, (remainingUsd / limitUsd) * 100))
      : 0;

  return {
    client_id: account.clientId,
    tier: account.tier,
    status: account.status,
    monthly_period: account.monthlyPeriod,
    monthly_included_usd: account.monthlyIncludedUsd,
    monthly_included_used_usd: account.monthlyIncludedUsedUsd,
    included_remaining_usd: allowance.includedRemainingUsd,
    prepaid_balance_usd: account.prepaidBalanceUsd,
    prepaid_remaining_usd: allowance.prepaidRemainingUsd,
    remaining_usd: remainingUsd,
    used_usd: usedUsd,
    remaining_percent: remainingPercent,
    low_balance:
      account.status === "active" &&
      remainingUsd > 0 &&
      remainingPercent <= config.botLowBalanceWarningThresholdPercent,
    warning_threshold_percent: config.botLowBalanceWarningThresholdPercent,
  };
}

type BotMessage = {
  id: string;
  text: string;
  timestamp?: string;
};

type BotHistoryMessage = {
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
};

type RespondPayload = {
  phone?: string;
  instructions?: string;
  message: BotMessage;
  history: BotHistoryMessage[];
};

type ChatCompletionPayload = {
  model: string;
  history: ChatMessage[];
  messages: ChatMessage[];
  assistantId?: string;
  temperature?: number;
  maxTokens?: number;
};

type CardPaymentPayload = {
  plan: "on_demand" | "high_usage";
  clientId: string;
  token: string;
  paymentMethodId: string;
  issuerId?: string | number;
  installments: number;
  payer: {
    email: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
};

function isAuthorized(req: IncomingMessage, config: AppConfig): boolean {
  const apiKey = req.headers["x-api-key"];
  if (apiKey === config.apiKey) {
    return true;
  }

  const authorization = req.headers.authorization;
  return authorization === `Bearer ${config.apiKey}`;
}

function getClientId(req: IncomingMessage): string | null {
  const value = req.headers["x-taku-client-id"];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getBodyClientId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const value = (body as Record<string, unknown>).client_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseInstructionsBody(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const instructions = (body as Record<string, unknown>).instructions;
  return typeof instructions === "string" && instructions.trim()
    ? instructions.trim()
    : null;
}

function parseAssistantBody(
  body: unknown,
): { name: string; instructions: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const name = record.name;
  const instructions = record.instructions;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof instructions !== "string" ||
    !instructions.trim()
  ) {
    return null;
  }

  return {
    name: name.trim(),
    instructions: instructions.trim(),
  };
}

function parseRespondBody(body: unknown): RespondPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const message = record.message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return null;
  }

  const messageRecord = message as Record<string, unknown>;
  if (
    typeof messageRecord.id !== "string" ||
    !messageRecord.id.trim() ||
    typeof messageRecord.text !== "string" ||
    !messageRecord.text.trim()
  ) {
    return null;
  }

  const history = Array.isArray(record.history)
    ? record.history.flatMap((item): BotHistoryMessage[] => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return [];
        }

        const historyRecord = item as Record<string, unknown>;
        if (
          (historyRecord.role !== "user" &&
            historyRecord.role !== "assistant") ||
          typeof historyRecord.text !== "string" ||
          !historyRecord.text.trim()
        ) {
          return [];
        }

        return [
          {
            role: historyRecord.role,
            text: historyRecord.text.trim(),
            timestamp:
              typeof historyRecord.timestamp === "string"
                ? historyRecord.timestamp
                : undefined,
          },
        ];
      })
    : [];

  return {
    phone: typeof record.phone === "string" ? record.phone.trim() : undefined,
    instructions:
      typeof record.instructions === "string" && record.instructions.trim()
        ? record.instructions.trim()
        : undefined,
    message: {
      id: messageRecord.id.trim(),
      text: messageRecord.text.trim(),
      timestamp:
        typeof messageRecord.timestamp === "string"
          ? messageRecord.timestamp
          : undefined,
    },
    history,
  };
}

function parseDeepSeekTestBody(body: unknown): { message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { message: "Reply with exactly: deepseek-ok" };
  }

  const message = (body as Record<string, unknown>).message;
  return typeof message === "string" && message.trim()
    ? { message: message.trim() }
    : { message: "Reply with exactly: deepseek-ok" };
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseCardPaymentBody(body: unknown): CardPaymentPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const token = readString(record, "token");
  const rawPlan = readString(record, "plan");
  const plan =
    rawPlan === "business"
      ? "on_demand"
      : rawPlan === "platform"
        ? "high_usage"
        : rawPlan;
  const clientId = readString(record, "client_id");
  const paymentMethodId = readString(record, "payment_method_id");
  const payer = record.payer;
  const payerRecord =
    payer && typeof payer === "object" && !Array.isArray(payer)
      ? (payer as Record<string, unknown>)
      : null;
  const payerEmail = payerRecord ? readString(payerRecord, "email") : null;
  const installments = Number(record.installments ?? 1);

  if (
    !isBotPaymentPlan(plan) ||
    !clientId ||
    !token ||
    !paymentMethodId ||
    !payerEmail ||
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > 48
  ) {
    return null;
  }

  const identification = payerRecord?.identification;
  const identificationRecord =
    identification &&
    typeof identification === "object" &&
    !Array.isArray(identification)
      ? (identification as Record<string, unknown>)
      : null;
  const identificationType = identificationRecord
    ? readString(identificationRecord, "type")
    : null;
  const identificationNumber = identificationRecord
    ? readString(identificationRecord, "number")
    : null;

  return {
    plan,
    clientId,
    token,
    paymentMethodId,
    issuerId:
      typeof record.issuer_id === "string" ||
      typeof record.issuer_id === "number"
        ? record.issuer_id
        : undefined,
    installments,
    payer: {
      email: payerEmail,
      identification:
        identificationType || identificationNumber
          ? {
              type: identificationType ?? undefined,
              number: identificationNumber ?? undefined,
            }
          : undefined,
    },
  };
}

function getWebhookPaymentId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const data = record.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const dataId = (data as Record<string, unknown>).id;
    if (typeof dataId === "string" || typeof dataId === "number") {
      return String(dataId);
    }
  }

  const topic = record.topic ?? record.type;
  const id = record.id;
  return (topic === "payment" || record.action === "payment.updated") &&
    (typeof id === "string" || typeof id === "number")
    ? String(id)
    : null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function parseChatMessages(
  value: unknown,
  options?: { allowSystem?: boolean },
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): ChatMessage[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const message = item as Record<string, unknown>;
    const role = message.role;
    const content =
      typeof message.content === "string"
        ? message.content
        : typeof message.text === "string"
          ? message.text
          : null;
    const validRole =
      role === "user" ||
      role === "assistant" ||
      (options?.allowSystem && role === "system");

    if (!validRole || !content?.trim()) {
      return [];
    }

    return [
      {
        role,
        content: content.trim(),
      } as ChatMessage,
    ];
  });
}

function parseChatCompletionBody(
  body: unknown,
  config: AppConfig,
): ChatCompletionPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.messages)) {
    return null;
  }

  const messages = parseChatMessages(record.messages, { allowSystem: true });

  if (messages.length === 0) {
    return null;
  }

  const model =
    typeof record.model === "string" && record.model.trim()
      ? record.model.trim()
      : (config.botModels[0] ?? "taku-cr");

  return {
    model,
    history: parseChatMessages(record.history),
    messages,
    assistantId:
      typeof record.assistant_id === "string" && record.assistant_id.trim()
        ? record.assistant_id.trim()
        : undefined,
    temperature: readNumber(record, "temperature"),
    maxTokens: readNumber(record, "max_tokens"),
  };
}

function buildChatMessages(params: {
  instructions: string;
  message: BotMessage;
  history: BotHistoryMessage[];
}): ChatMessage[] {
  const historyMessages: ChatMessage[] = params.history.slice(-10).map(
    (message): ChatMessage => ({
      role: message.role,
      content: message.text,
    }),
  );

  return [
    {
      role: "system",
      content: params.instructions,
    },
    ...historyMessages,
    {
      role: "user",
      content: params.message.text,
    },
  ];
}

function isBotProviderError(error: unknown): error is DeepSeekProviderError {
  return error instanceof DeepSeekProviderError;
}

function buildBotProviderUnavailableResponse(): JsonResponse {
  return {
    status: 503,
    body: {
      ok: false,
      error: "Bot provider unavailable",
      code: "BOT_PROVIDER_UNAVAILABLE",
      fallbackMessage:
        "Por ahora no puedo consultar al asistente. Un momento por favor, alguien del equipo te atendera.",
    },
  };
}

function buildUnauthorizedResponse(): JsonResponse {
  return {
    status: 401,
    body: { ok: false, error: "Unauthorized" },
  };
}

function masked(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.length <= 8
    ? `${value.slice(0, 2)}...`
    : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function completeApprovedPaymentIntent(params: {
  config: AppConfig;
  paymentIntentId: string;
  providerPaymentId: string;
  paidAt: string | null;
}) {
  const existingIntent = await getBotPaymentIntent({
    filePath: params.config.paymentIntentsFile,
    paymentIntentId: params.paymentIntentId,
  });
  const paymentIntent = await completeBotPaymentIntent({
    filePath: params.config.paymentIntentsFile,
    paymentIntentId: params.paymentIntentId,
    providerPaymentId: params.providerPaymentId,
    paidAt: params.paidAt ?? new Date().toISOString(),
  });
  const billingAccount =
    existingIntent?.status === "pending" && paymentIntent.attachedAccountId
      ? await creditPrepaidBillingAccount({
          filePath: params.config.billingAccountsFile,
          clientId: paymentIntent.attachedAccountId,
          tier: paymentIntent.toPlan,
          amountUsd: paymentIntent.amountUsd,
          rules: getBillingRules(params.config),
        })
      : null;

  return { paymentIntent, billingAccount };
}

async function buildAdminOverview(config: AppConfig) {
  const billingRules = getBillingRules(config);
  const [accounts, usage, paymentIntents] = await Promise.all([
    listBillingAccounts({
      filePath: config.billingAccountsFile,
      rules: billingRules,
    }),
    getUsageSummary({ filePath: config.usageFile }),
    listBotPaymentIntents({ filePath: config.paymentIntentsFile }),
  ]);

  const tierCounts: Record<string, number> = {
    free: 0,
    on_demand: 0,
    high_usage: 0,
  };
  const statusCounts: Record<string, number> = {
    active: 0,
    blocked: 0,
    suspended: 0,
  };
  const usageByClient = new Map(
    usage.byClient.map((client) => [client.clientId, client]),
  );
  let totalPrepaidBalanceUsd = 0;
  let totalIncludedRemainingUsd = 0;

  const accountSummaries = accounts.map((account) => {
    tierCounts[account.tier] = (tierCounts[account.tier] ?? 0) + 1;
    statusCounts[account.status] = (statusCounts[account.status] ?? 0) + 1;
    const allowance = getBillingAllowance(account);
    const accountUsage = usageByClient.get(account.clientId);
    totalPrepaidBalanceUsd += allowance.prepaidRemainingUsd;
    totalIncludedRemainingUsd += allowance.includedRemainingUsd;

    return {
      clientId: account.clientId,
      tier: account.tier,
      status: account.status,
      monthlyPeriod: account.monthlyPeriod,
      monthlyIncludedUsd: account.monthlyIncludedUsd,
      monthlyIncludedUsedUsd: account.monthlyIncludedUsedUsd,
      includedRemainingUsd: allowance.includedRemainingUsd,
      prepaidBalanceUsd: account.prepaidBalanceUsd,
      prepaidRemainingUsd: allowance.prepaidRemainingUsd,
      markupPercent: account.markupPercent,
      requests: accountUsage?.requests ?? 0,
      totalTokens: accountUsage?.totalTokens ?? 0,
      estimatedProviderCostUsd: accountUsage?.estimatedProviderCostUsd ?? 0,
      estimatedChargeUsd: accountUsage?.estimatedChargeUsd ?? 0,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  });

  const paymentStatusCounts = paymentIntents.reduce<Record<string, number>>(
    (counts, intent) => ({
      ...counts,
      [intent.status]: (counts[intent.status] ?? 0) + 1,
    }),
    { pending: 0, paid: 0, attached: 0 },
  );
  const paidAmountUsd = paymentIntents
    .filter(
      (intent) => intent.status === "paid" || intent.status === "attached",
    )
    .reduce((total, intent) => total + intent.amountUsd, 0);

  return {
    totalAccounts: accounts.length,
    tierCounts,
    statusCounts,
    billing: {
      totalPrepaidBalanceUsd,
      totalIncludedRemainingUsd,
      paymentStatusCounts,
      paidAmountUsd,
      recentPaymentIntents: paymentIntents.slice(0, 10),
    },
    usage: {
      requests: usage.requests,
      successfulRequests: usage.successfulRequests,
      failedRequests: usage.failedRequests,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      estimatedProviderCostUsd: usage.estimatedProviderCostUsd,
      estimatedChargeUsd: usage.estimatedChargeUsd,
      estimatedMarginUsd:
        usage.estimatedChargeUsd - usage.estimatedProviderCostUsd,
      averageLatencyMs: usage.averageLatencyMs,
      topClients: usage.byClient.slice(0, 10),
      topAssistants: usage.byAssistant.slice(0, 10),
    },
    accounts: accountSummaries,
  };
}

export function createBotServer(config: AppConfig, logger: Logger) {
  return createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const path = requestUrl.pathname;

    let response: JsonResponse;

    try {
      if (method === "GET" && path === "/debug/logs") {
        sendDebugLogsPage(res, "bot-service logs");
        return;
      } else if (method === "GET" && path === "/debug/logs/recent") {
        response = { status: 200, body: { ok: true, logs: listDebugLogs() } };
      } else if (method === "GET" && path === "/debug/logs/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
        const unsubscribe = subscribeDebugLogs((entry) => {
          res.write(`data: ${JSON.stringify(entry)}\n\n`);
        });
        req.on("close", unsubscribe);
        return;
      } else if (method === "GET" && path === "/health") {
        response = { status: 200, body: { ok: true } };
      } else if (method === "GET" && path === "/v1/health") {
        response = {
          status: 200,
          body: { ok: true, service: "bot-service", version: "v1" },
        };
      } else if (method === "GET" && path === "/v1/runtime/status") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          response = {
            status: 200,
            body: {
              ok: true,
              service: "bot-service",
              checkedAt: new Date().toISOString(),
              runtime: {
                host: config.host,
                port: config.port,
                models: config.botModels,
                deepseekBaseUrl: config.deepseekBaseUrl,
                deepseekModel: config.deepseekModel,
                mercadoPagoCurrencyId: config.mercadoPagoCurrencyId,
                pricing: {
                  inputCacheMissUsdPerMillion:
                    config.deepseekInputCacheMissUsdPerMillion,
                  outputUsdPerMillion: config.deepseekOutputUsdPerMillion,
                  defaultChargeMarkupPercent:
                    config.botServiceChargeMarkupPercent,
                  freeMonthlyIncludedUsd: config.botFreeMonthlyIncludedUsd,
                  freeMarkupPercent: config.botFreeMarkupPercent,
                  onDemandMinPrepaidUsd: config.botOnDemandMinPrepaidUsd,
                  onDemandMarkupPercent: config.botOnDemandMarkupPercent,
                  highUsageMinPrepaidUsd: config.botHighUsageMinPrepaidUsd,
                  highUsageMarkupPercent: config.botHighUsageMarkupPercent,
                  lowBalanceWarningThresholdPercent:
                    config.botLowBalanceWarningThresholdPercent,
                },
              },
              variables: [
                {
                  name: "BOT_SERVICE_API_KEY",
                  configured: Boolean(config.apiKey),
                  maskedValue: masked(config.apiKey),
                  required: true,
                },
                {
                  name: "DEEPSEEK_API_KEY",
                  configured: Boolean(config.deepseekApiKey),
                  maskedValue: masked(config.deepseekApiKey),
                  required: true,
                },
                {
                  name: "DEEPSEEK_BASE_URL",
                  configured: Boolean(config.deepseekBaseUrl),
                  value: config.deepseekBaseUrl,
                  required: true,
                },
                {
                  name: "DEEPSEEK_MODEL",
                  configured: Boolean(config.deepseekModel),
                  value: config.deepseekModel,
                  required: true,
                },
                {
                  name: "BOT_MODELS",
                  configured: config.botModels.length > 0,
                  value: config.botModels.join(","),
                  required: true,
                },
                {
                  name: "BOT_ASSISTANTS_FILE",
                  configured: Boolean(config.assistantsFile),
                  value: config.assistantsFile,
                  required: true,
                },
                {
                  name: "BOT_PAYMENT_INTENTS_FILE",
                  configured: Boolean(config.paymentIntentsFile),
                  value: config.paymentIntentsFile,
                  required: true,
                },
                {
                  name: "BOT_USAGE_FILE",
                  configured: Boolean(config.usageFile),
                  value: config.usageFile,
                  required: true,
                },
                {
                  name: "BOT_BILLING_ACCOUNTS_FILE",
                  configured: Boolean(config.billingAccountsFile),
                  value: config.billingAccountsFile,
                  required: true,
                },
                {
                  name: "DEEPSEEK_INPUT_CACHE_MISS_USD_PER_1M",
                  configured: Number.isFinite(
                    config.deepseekInputCacheMissUsdPerMillion,
                  ),
                  value: String(config.deepseekInputCacheMissUsdPerMillion),
                  required: true,
                },
                {
                  name: "DEEPSEEK_OUTPUT_USD_PER_1M",
                  configured: Number.isFinite(
                    config.deepseekOutputUsdPerMillion,
                  ),
                  value: String(config.deepseekOutputUsdPerMillion),
                  required: true,
                },
                {
                  name: "BOT_SERVICE_CHARGE_MARKUP_PERCENT",
                  configured: Number.isFinite(
                    config.botServiceChargeMarkupPercent,
                  ),
                  value: String(config.botServiceChargeMarkupPercent),
                  required: true,
                },
                {
                  name: "BOT_FREE_MONTHLY_INCLUDED_USD",
                  configured: Number.isFinite(config.botFreeMonthlyIncludedUsd),
                  value: String(config.botFreeMonthlyIncludedUsd),
                  required: true,
                },
                {
                  name: "BOT_FREE_MARKUP_PERCENT",
                  configured: Number.isFinite(config.botFreeMarkupPercent),
                  value: String(config.botFreeMarkupPercent),
                  required: true,
                },
                {
                  name: "BOT_ON_DEMAND_MIN_PREPAID_USD",
                  configured: Number.isFinite(config.botOnDemandMinPrepaidUsd),
                  value: String(config.botOnDemandMinPrepaidUsd),
                  required: true,
                },
                {
                  name: "BOT_ON_DEMAND_MARKUP_PERCENT",
                  configured: Number.isFinite(config.botOnDemandMarkupPercent),
                  value: String(config.botOnDemandMarkupPercent),
                  required: true,
                },
                {
                  name: "BOT_HIGH_USAGE_MIN_PREPAID_USD",
                  configured: Number.isFinite(config.botHighUsageMinPrepaidUsd),
                  value: String(config.botHighUsageMinPrepaidUsd),
                  required: true,
                },
                {
                  name: "BOT_HIGH_USAGE_MARKUP_PERCENT",
                  configured: Number.isFinite(config.botHighUsageMarkupPercent),
                  value: String(config.botHighUsageMarkupPercent),
                  required: true,
                },
                {
                  name: "BOT_LOW_BALANCE_WARNING_THRESHOLD_PERCENT",
                  configured: Number.isFinite(
                    config.botLowBalanceWarningThresholdPercent,
                  ),
                  value: String(config.botLowBalanceWarningThresholdPercent),
                  required: true,
                },
                {
                  name: "BOT_PROCESSED_MESSAGES_FILE",
                  configured: Boolean(config.processedMessagesFile),
                  value: config.processedMessagesFile,
                  required: true,
                },
                {
                  name: "MERCADOPAGO_ACCESS_TOKEN",
                  configured: Boolean(config.mercadoPagoAccessToken),
                  maskedValue: masked(config.mercadoPagoAccessToken),
                  required: true,
                },
                {
                  name: "MERCADOPAGO_CURRENCY_ID",
                  configured: Boolean(config.mercadoPagoCurrencyId),
                  value: config.mercadoPagoCurrencyId,
                  required: true,
                },
              ],
            },
          };
        }
      } else if (
        method === "POST" &&
        path === "/v1/public/billing/card-payment"
      ) {
        const payload = parseCardPaymentBody(await readRequestJson(req));
        if (!payload) {
          response = {
            status: 400,
            body: {
              ok: false,
              error: "Invalid card payment payload",
            },
          };
        } else if (!config.mercadoPagoAccessToken) {
          response = {
            status: 503,
            body: {
              ok: false,
              error: "Mercado Pago access token is not configured",
            },
          };
        } else {
          try {
            const plan = getConfiguredBotPaymentPlan(config, payload.plan);
            const intent = await createBotPaymentIntent({
              filePath: config.paymentIntentsFile,
              toPlan: payload.plan,
              planDetails: plan,
              attachedAccountId: payload.clientId,
            });
            const payment = await createMercadoPagoCardPayment({
              accessToken: config.mercadoPagoAccessToken,
              token: payload.token,
              transactionAmount: plan.amountUsd,
              installments: payload.installments,
              paymentMethodId: payload.paymentMethodId,
              issuerId: payload.issuerId ?? null,
              payer: payload.payer,
              description: `TAKU Bot ${plan.name}`,
              externalReference: intent.id,
              idempotencyKey: randomUUID(),
            });

            if (payment.status !== "approved") {
              response = {
                status: 402,
                body: {
                  ok: false,
                  error: `Payment is ${payment.status}`,
                  paymentStatus: payment.status,
                  paymentStatusDetail: payment.statusDetail,
                  paymentIntent: intent,
                },
              };
            } else {
              const completed = await completeApprovedPaymentIntent({
                config,
                paymentIntentId: intent.id,
                providerPaymentId: payment.id,
                paidAt: payment.dateApproved,
              });
              response = {
                status: 201,
                body: {
                  ok: true,
                  paymentIntent: completed.paymentIntent,
                  billingAccount: completed.billingAccount,
                  paymentStatus: payment.status,
                },
              };
            }
          } catch (error) {
            if (error instanceof MercadoPagoRequestError) {
              response = {
                status: 400,
                body: {
                  ok: false,
                  error: error.message,
                  providerStatus: error.status,
                  providerError: error.error,
                  providerCauses: error.causes,
                },
              };
            } else {
              response = {
                status: 400,
                body: {
                  ok: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Could not process card payment",
                },
              };
            }
          }
        }
      } else if (
        method === "GET" &&
        path.startsWith("/v1/public/billing/intents/")
      ) {
        const paymentIntentId = decodeURIComponent(
          path.replace("/v1/public/billing/intents/", "").split("/")[0] ?? "",
        );
        const intent = paymentIntentId
          ? await getBotPaymentIntent({
              filePath: config.paymentIntentsFile,
              paymentIntentId,
            })
          : null;
        response = intent
          ? { status: 200, body: { ok: true, paymentIntent: intent } }
          : {
              status: 404,
              body: { ok: false, error: "Payment intent not found" },
            };
      } else if (
        method === "POST" &&
        path.startsWith("/v1/public/billing/intents/") &&
        path.endsWith("/confirm")
      ) {
        const paymentIntentId = decodeURIComponent(
          path
            .replace("/v1/public/billing/intents/", "")
            .replace("/confirm", ""),
        );
        const intent = paymentIntentId
          ? await getBotPaymentIntent({
              filePath: config.paymentIntentsFile,
              paymentIntentId,
            })
          : null;
        if (!intent) {
          response = {
            status: 404,
            body: { ok: false, error: "Payment intent not found" },
          };
        } else if (
          intent.status === "paid" ||
          intent.status === "attached" ||
          !config.mercadoPagoAccessToken
        ) {
          response = { status: 200, body: { ok: true, paymentIntent: intent } };
        } else {
          const payment = await findMercadoPagoPaymentByExternalReference({
            accessToken: config.mercadoPagoAccessToken,
            externalReference: intent.id,
          });
          if (!payment || payment.status !== "approved") {
            response = {
              status: 200,
              body: {
                ok: true,
                paymentIntent: intent,
                paymentStatus: payment?.status ?? "not_found",
              },
            };
          } else {
            const completed = await completeApprovedPaymentIntent({
              config,
              paymentIntentId: intent.id,
              providerPaymentId: payment.id,
              paidAt: payment.dateApproved,
            });
            response = {
              status: 200,
              body: {
                ok: true,
                paymentIntent: completed.paymentIntent,
                billingAccount: completed.billingAccount,
                paymentStatus: payment.status,
              },
            };
          }
        }
      } else if (
        method === "POST" &&
        path === "/v1/public/billing/mercadopago/webhook"
      ) {
        const paymentId = getWebhookPaymentId(await readRequestJson(req));
        if (!paymentId) {
          response = {
            status: 202,
            body: {
              ok: true,
              ignored: true,
              reason: "Notification did not include a payment id",
            },
          };
        } else if (!config.mercadoPagoAccessToken) {
          response = {
            status: 503,
            body: {
              ok: false,
              error: "Mercado Pago access token is not configured",
            },
          };
        } else {
          const payment = await getMercadoPagoPayment({
            accessToken: config.mercadoPagoAccessToken,
            paymentId,
          });
          if (!payment.externalReference) {
            response = {
              status: 202,
              body: {
                ok: true,
                ignored: true,
                reason: "Payment did not include a BOT payment intent",
              },
            };
          } else if (payment.status !== "approved") {
            response = {
              status: 202,
              body: {
                ok: true,
                ignored: true,
                reason: `Payment is ${payment.status}`,
              },
            };
          } else {
            const completed = await completeApprovedPaymentIntent({
              config,
              paymentIntentId: payment.externalReference,
              providerPaymentId: payment.id,
              paidAt: payment.dateApproved,
            });
            response = {
              status: 200,
              body: {
                ok: true,
                paymentIntent: completed.paymentIntent,
                billingAccount: completed.billingAccount,
              },
            };
          }
        }
      } else if (method === "GET" && path === "/v1/models") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          response = {
            status: 200,
            body: {
              object: "list",
              data: [
                ...config.botModels.map((model) => ({
                  id: model,
                  object: "model",
                  created: 0,
                  owned_by: "taku",
                })),
              ],
            },
          };
        }
      } else if (method === "GET" && path === "/v1/usage/summary") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          response = {
            status: 200,
            body: {
              ok: true,
              summary: await getUsageSummary({
                filePath: config.usageFile,
                clientId: requestUrl.searchParams.get("client_id"),
                assistantId: requestUrl.searchParams.get("assistant_id"),
              }),
            },
          };
        }
      } else if (method === "GET" && path === "/v1/usage/events") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          const limit = Math.min(
            200,
            Math.max(1, Number(requestUrl.searchParams.get("limit") ?? 50)),
          );
          response = {
            status: 200,
            body: {
              ok: true,
              events: await listUsageEvents({
                filePath: config.usageFile,
                limit,
                clientId: requestUrl.searchParams.get("client_id"),
                assistantId: requestUrl.searchParams.get("assistant_id"),
              }),
            },
          };
        }
      } else if (method === "GET" && path === "/v1/admin/overview") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          response = {
            status: 200,
            body: {
              ok: true,
              overview: await buildAdminOverview(config),
            },
          };
        }
      } else if (method === "GET" && path === "/v1/billing/account") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          const clientId = getClientId(req);
          if (!clientId) {
            response = {
              status: 400,
              body: { ok: false, error: "x-taku-client-id is required" },
            };
          } else {
            const account = await getOrCreateBillingAccount({
              filePath: config.billingAccountsFile,
              clientId,
              rules: getBillingRules(config),
            });
            response = {
              status: 200,
              body: {
                ok: true,
                billing: buildBillingStatus(account, config),
              },
            };
          }
        }
      } else if (method === "GET" && path === "/v1/assistants") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          const clientId = getClientId(req);
          response = clientId
            ? {
                status: 200,
                body: {
                  ok: true,
                  object: "list",
                  assistants: await listAssistants(
                    config.assistantsFile,
                    clientId,
                  ),
                },
              }
            : {
                status: 400,
                body: { ok: false, error: "x-taku-client-id is required" },
              };
        }
      } else if (method === "POST" && path === "/v1/assistants") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          const clientId = getClientId(req);
          const payload = parseAssistantBody(await readRequestJson(req));
          if (!clientId) {
            response = {
              status: 400,
              body: { ok: false, error: "x-taku-client-id is required" },
            };
          } else if (!payload) {
            response = {
              status: 400,
              body: {
                ok: false,
                error: "name and instructions are required",
              },
            };
          } else {
            response = {
              status: 201,
              body: {
                ok: true,
                assistant: await createAssistant({
                  filePath: config.assistantsFile,
                  clientId,
                  name: payload.name,
                  instructions: payload.instructions,
                }),
              },
            };
          }
        }
      } else if (method === "PATCH" && path.startsWith("/v1/assistants/")) {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          const clientId = getClientId(req);
          const assistantId = decodeURIComponent(
            path.replace("/v1/assistants/", ""),
          );
          const payload = parseAssistantBody(await readRequestJson(req));
          if (!clientId) {
            response = {
              status: 400,
              body: { ok: false, error: "x-taku-client-id is required" },
            };
          } else if (!assistantId || !payload) {
            response = {
              status: 400,
              body: {
                ok: false,
                error: "assistant id, name, and instructions are required",
              },
            };
          } else {
            const assistant = await updateAssistant({
              filePath: config.assistantsFile,
              assistantId,
              clientId,
              name: payload.name,
              instructions: payload.instructions,
            });
            response = assistant
              ? { status: 200, body: { ok: true, assistant } }
              : {
                  status: 404,
                  body: { ok: false, error: "Assistant not found" },
                };
          }
        }
      } else if (method === "POST" && path === "/v1/chat/completions") {
        const requestId = `chatcmpl_${randomUUID()}`;
        const startedAt = Date.now();
        const body = await readRequestJson(req);
        const clientId = getClientId(req) ?? getBodyClientId(body);
        const billingRules = getBillingRules(config);
        const payload = parseChatCompletionBody(body, config);
        const pricing = getUsagePricing(config);
        if (!isAuthorized(req, config)) {
          await recordUsageEvent({
            filePath: config.usageFile,
            requestId,
            clientId,
            assistantId: payload?.assistantId ?? null,
            model: payload?.model ?? "unknown",
            status: "error",
            pricing,
            latencyMs: Date.now() - startedAt,
            errorCode: "UNAUTHORIZED",
            errorType: "authentication_error",
            errorMessage: "Unauthorized",
            httpStatus: 401,
          });
          response = buildUnauthorizedResponse();
        } else {
          if (!payload) {
            await recordUsageEvent({
              filePath: config.usageFile,
              requestId,
              clientId,
              assistantId: null,
              model: "unknown",
              status: "error",
              pricing,
              latencyMs: Date.now() - startedAt,
              errorCode: "INVALID_REQUEST",
              errorType: "invalid_request_error",
              errorMessage: "messages is required",
              httpStatus: 400,
            });
            response = {
              status: 400,
              body: {
                error: {
                  message: "messages is required",
                  type: "invalid_request_error",
                },
              },
            };
          } else if (!clientId) {
            await recordUsageEvent({
              filePath: config.usageFile,
              requestId,
              clientId,
              assistantId: payload.assistantId ?? null,
              model: payload.model,
              status: "error",
              pricing,
              latencyMs: Date.now() - startedAt,
              errorCode: "CLIENT_ID_REQUIRED",
              errorType: "invalid_request_error",
              errorMessage: "client_id or x-taku-client-id is required",
              httpStatus: 400,
            });
            response = {
              status: 400,
              body: {
                error: {
                  message: "client_id or x-taku-client-id is required",
                  type: "invalid_request_error",
                  code: "CLIENT_ID_REQUIRED",
                },
              },
            };
          } else if (!config.botModels.includes(payload.model)) {
            await recordUsageEvent({
              filePath: config.usageFile,
              requestId,
              clientId,
              assistantId: payload.assistantId ?? null,
              model: payload.model,
              status: "error",
              pricing,
              latencyMs: Date.now() - startedAt,
              errorCode: "MODEL_NOT_AVAILABLE",
              errorType: "invalid_request_error",
              errorMessage: `Unsupported model: ${payload.model}`,
              httpStatus: 400,
            });
            response = {
              status: 400,
              body: {
                error: {
                  message: `Unsupported model: ${payload.model}`,
                  type: "invalid_request_error",
                  code: "MODEL_NOT_AVAILABLE",
                },
              },
            };
          } else {
            try {
              const billingAccount = await getOrCreateBillingAccount({
                filePath: config.billingAccountsFile,
                clientId,
                rules: billingRules,
              });
              const accountPricing = getUsagePricing(config, billingAccount);
              const billingStatus = buildBillingStatus(billingAccount, config);
              const balanceBlocked =
                billingAccount.status !== "active" ||
                billingStatus.remaining_usd <= 0;
              if (balanceBlocked) {
                await recordUsageEvent({
                  filePath: config.usageFile,
                  requestId,
                  clientId,
                  assistantId: payload.assistantId ?? null,
                  billingTier: billingAccount.tier,
                  model: payload.model,
                  status: "error",
                  pricing: accountPricing,
                  latencyMs: Date.now() - startedAt,
                  errorCode:
                    billingAccount.tier === "free"
                      ? "FREE_USAGE_EXHAUSTED"
                      : "PREPAID_BALANCE_EXHAUSTED",
                  errorType: "billing_error",
                  errorMessage:
                    billingAccount.tier === "free"
                      ? `Free monthly usage is exhausted. Remaining credit: $${billingStatus.remaining_usd.toFixed(4)}`
                      : `Prepaid balance is exhausted. Remaining credit: $${billingStatus.remaining_usd.toFixed(4)}`,
                  httpStatus: 402,
                });
                response = {
                  status: 402,
                  body: {
                    error: {
                      message:
                        billingAccount.tier === "free"
                          ? `Free monthly usage is exhausted. Remaining credit: $${billingStatus.remaining_usd.toFixed(4)}`
                          : `Prepaid balance is exhausted. Remaining credit: $${billingStatus.remaining_usd.toFixed(4)}`,
                      type: "billing_error",
                      code:
                        billingAccount.tier === "free"
                          ? "FREE_USAGE_EXHAUSTED"
                          : "PREPAID_BALANCE_EXHAUSTED",
                    },
                    billing: billingStatus,
                  },
                };
              } else {
                const assistant = payload.assistantId
                  ? await getAssistant({
                      filePath: config.assistantsFile,
                      assistantId: payload.assistantId,
                      clientId,
                    })
                  : null;
                if (payload.assistantId && !assistant) {
                  await recordUsageEvent({
                    filePath: config.usageFile,
                    requestId,
                    clientId,
                    assistantId: payload.assistantId,
                    billingTier: billingAccount.tier,
                    model: payload.model,
                    status: "error",
                    pricing: accountPricing,
                    latencyMs: Date.now() - startedAt,
                    errorCode: "ASSISTANT_NOT_FOUND",
                    errorType: "invalid_request_error",
                    errorMessage: "Assistant not found",
                    httpStatus: 404,
                  });
                  response = {
                    status: 404,
                    body: {
                      error: {
                        message: "Assistant not found",
                        type: "invalid_request_error",
                        code: "ASSISTANT_NOT_FOUND",
                      },
                    },
                  };
                } else {
                  const messages: ChatMessage[] = assistant
                    ? [
                        {
                          role: "system",
                          content: assistant.instructions,
                        },
                        ...payload.history,
                        ...payload.messages,
                      ]
                    : [...payload.history, ...payload.messages];
                  const reply = await createDeepSeekChatReply({
                    config,
                    messages,
                    temperature: payload.temperature,
                    maxTokens: payload.maxTokens,
                  });
                  const usageEvent = await recordUsageEvent({
                    filePath: config.usageFile,
                    requestId,
                    clientId,
                    assistantId: assistant?.id ?? null,
                    billingTier: billingAccount.tier,
                    model: payload.model,
                    status: "success",
                    usage: reply.usage,
                    pricing: accountPricing,
                    latencyMs: Date.now() - startedAt,
                  });
                  const updatedBillingAccount = await debitBillingAccount({
                    filePath: config.billingAccountsFile,
                    clientId,
                    chargeUsd: usageEvent.estimatedChargeUsd ?? 0,
                    rules: billingRules,
                  });
                  const created = Math.floor(Date.now() / 1000);
                  response = {
                    status: 200,
                    body: {
                      id: requestId,
                      object: "chat.completion",
                      created,
                      model: payload.model,
                      assistant_id: assistant?.id ?? null,
                      choices: [
                        {
                          index: 0,
                          message: {
                            role: "assistant",
                            content: reply.text,
                          },
                          finish_reason: "stop",
                        },
                      ],
                      usage: {
                        prompt_tokens: reply.usage.promptTokens,
                        completion_tokens: reply.usage.completionTokens,
                        total_tokens: reply.usage.totalTokens,
                      },
                      billing: {
                        ...buildBillingStatus(updatedBillingAccount, config),
                        estimated_provider_cost_usd:
                          usageEvent.estimatedProviderCostUsd,
                        estimated_charge_usd: usageEvent.estimatedChargeUsd,
                      },
                    },
                  };
                }
              }
            } catch (error) {
              const isProviderError = isBotProviderError(error);
              const isInvalidProviderResponse =
                error instanceof DeepSeekInvalidResponseError;
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              const errorCode = isProviderError
                ? "BOT_PROVIDER_UNAVAILABLE"
                : "BOT_PROVIDER_INVALID_RESPONSE";
              await recordUsageEvent({
                filePath: config.usageFile,
                requestId,
                clientId,
                assistantId: payload.assistantId ?? null,
                billingTier: null,
                model: payload.model,
                status: "error",
                pricing,
                latencyMs: Date.now() - startedAt,
                errorCode,
                errorType: "provider_error",
                errorMessage: isProviderError
                  ? "Bot provider unavailable"
                  : errorMessage,
                httpStatus: 503,
                errorMetadata: isInvalidProviderResponse
                  ? { providerResponse: error.responseSummary }
                  : null,
              });
              logger.error(
                {
                  err: error,
                  providerStatus: isProviderError ? error.status : undefined,
                  providerBody: isProviderError
                    ? error.responseBody
                    : undefined,
                  providerResponseSummary: isInvalidProviderResponse
                    ? error.responseSummary
                    : undefined,
                },
                isProviderError
                  ? "bot provider unavailable"
                  : "bot provider invalid response",
              );
              response = {
                status: 503,
                body: {
                  error: {
                    message: isProviderError
                      ? "Bot provider unavailable"
                      : "Bot provider returned an invalid response",
                    type: "provider_error",
                    code: errorCode,
                  },
                },
              };
            }
          }
        }
      } else if (method === "POST" && path === "/test/deepseek") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          const payload = parseDeepSeekTestBody(await readRequestJson(req));
          try {
            const replyText = await createDeepSeekReply({
              config,
              messages: [
                {
                  role: "system",
                  content:
                    "You are a terse connectivity smoke test. Keep the reply under 20 words.",
                },
                {
                  role: "user",
                  content: payload.message,
                },
              ],
            });
            response = {
              status: 200,
              body: {
                ok: true,
                model: config.deepseekModel,
                reply: {
                  text: replyText,
                },
              },
            };
          } catch (error) {
            if (!isBotProviderError(error)) {
              throw error;
            }

            logger.error(
              {
                err: error,
                providerStatus: error.status,
                providerBody: error.responseBody,
              },
              "bot provider unavailable",
            );
            response = buildBotProviderUnavailableResponse();
          }
        }
      } else if (method === "GET" && path === "/instructions") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          const instructions = await getInstructions(config.instructionsFile);
          response = instructions
            ? { status: 200, body: { ok: true, ...instructions } }
            : {
                status: 404,
                body: { ok: false, error: "No instructions configured" },
              };
        }
      } else if (method === "PUT" && path === "/instructions") {
        if (!isAuthorized(req, config)) {
          response = buildUnauthorizedResponse();
        } else {
          const instructions = parseInstructionsBody(
            await readRequestJson(req),
          );
          if (!instructions) {
            response = {
              status: 400,
              body: { ok: false, error: "instructions is required" },
            };
          } else {
            const record = await saveInstructions({
              filePath: config.instructionsFile,
              instructions,
            });
            response = { status: 200, body: { ok: true, ...record } };
          }
        }
      } else if (method === "POST" && path === "/respond") {
        if (!isAuthorized(req, config)) {
          recordDebugLog({
            level: "warn",
            event: "respond_unauthorized",
          });
          response = buildUnauthorizedResponse();
        } else {
          const payload = parseRespondBody(await readRequestJson(req));
          const storedInstructions = payload?.instructions
            ? null
            : await getInstructions(config.instructionsFile);
          const instructions =
            payload?.instructions ?? storedInstructions?.instructions ?? null;

          if (!instructions) {
            recordDebugLog({
              level: "warn",
              event: "respond_missing_instructions",
            });
            response = {
              status: 409,
              body: { ok: false, error: "No instructions configured" },
            };
          } else {
            if (!payload) {
              recordDebugLog({
                level: "warn",
                event: "respond_invalid_payload",
              });
              response = {
                status: 400,
                body: { ok: false, error: "Invalid respond payload" },
              };
            } else {
              recordDebugLog({
                event: "respond_request_received",
                data: {
                  messageId: payload.message.id,
                  phone: payload.phone,
                  textLength: payload.message.text.length,
                  historySize: payload.history.length,
                },
              });

              if (
                await hasProcessedMessage({
                  filePath: config.processedMessagesFile,
                  messageId: payload.message.id,
                })
              ) {
                recordDebugLog({
                  event: "respond_duplicate",
                  data: { messageId: payload.message.id, phone: payload.phone },
                });
                response = {
                  status: 200,
                  body: { ok: true, duplicate: true, reply: null },
                };
              } else {
                try {
                  recordDebugLog({
                    event: "deepseek_request",
                    data: {
                      messageId: payload.message.id,
                      phone: payload.phone,
                      historySize: payload.history.length,
                      model: config.deepseekModel,
                    },
                  });
                  const replyText = await createDeepSeekReply({
                    config,
                    messages: buildChatMessages({
                      instructions,
                      message: payload.message,
                      history: payload.history,
                    }),
                  });
                  await recordProcessedMessage({
                    filePath: config.processedMessagesFile,
                    messageId: payload.message.id,
                  });
                  logger.info(
                    {
                      messageId: payload.message.id,
                      historySize: payload.history.length,
                    },
                    "bot response generated",
                  );
                  recordDebugLog({
                    event: "respond_reply_generated",
                    data: {
                      messageId: payload.message.id,
                      phone: payload.phone,
                      historySize: payload.history.length,
                      replyLength: replyText.length,
                    },
                  });
                  response = {
                    status: 200,
                    body: {
                      ok: true,
                      duplicate: false,
                      reply: {
                        text: replyText,
                        shouldSend: true,
                      },
                    },
                  };
                } catch (error) {
                  if (!isBotProviderError(error)) {
                    throw error;
                  }

                  logger.error(
                    {
                      err: error,
                      messageId: payload.message.id,
                      providerStatus: error.status,
                      providerBody: error.responseBody,
                    },
                    "bot provider unavailable",
                  );
                  recordDebugLog({
                    level: "error",
                    event: "deepseek_provider_unavailable",
                    data: {
                      messageId: payload.message.id,
                      phone: payload.phone,
                      providerStatus: error.status,
                      providerBody: error.responseBody,
                    },
                  });
                  response = buildBotProviderUnavailableResponse();
                }
              }
            }
          }
        }
      } else {
        response = { status: 404, body: { ok: false, error: "Not found" } };
      }
    } catch (error) {
      logger.error({ err: error, method, path }, "request failed");
      recordDebugLog({
        level: "error",
        event: "request_failed",
        data: {
          method,
          path,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      response = { status: 500, body: { ok: false, error: "Internal error" } };
    }

    sendJson(res, response);
  });
}
