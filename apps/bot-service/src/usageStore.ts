import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "./jsonStore.js";
import type { ChatUsage } from "./deepseekClient.js";

export type UsageEventStatus = "success" | "error";

export type UsageEvent = {
  id: string;
  requestId: string;
  clientId: string | null;
  assistantId: string | null;
  billingTier?: string | null;
  model: string;
  status: UsageEventStatus;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedProviderCostUsd?: number;
  estimatedChargeUsd?: number;
  chargeMarkupPercent?: number;
  latencyMs: number;
  errorCode: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  httpStatus?: number | null;
  errorMetadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type UsagePricing = {
  inputCacheMissUsdPerMillion: number;
  outputUsdPerMillion: number;
  markupPercent: number;
};

type UsageStore = {
  events: UsageEvent[];
};

async function readStore(filePath: string): Promise<UsageStore> {
  const store = await readJson<UsageStore>(filePath, { events: [] });
  return {
    events: Array.isArray(store.events) ? store.events : [],
  };
}

export async function recordUsageEvent(params: {
  filePath: string;
  requestId: string;
  clientId?: string | null;
  assistantId?: string | null;
  billingTier?: string | null;
  model: string;
  status: UsageEventStatus;
  usage?: ChatUsage | null;
  pricing: UsagePricing;
  latencyMs: number;
  errorCode?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  httpStatus?: number | null;
  errorMetadata?: Record<string, unknown> | null;
}): Promise<UsageEvent> {
  const store = await readStore(params.filePath);
  const charge = estimateUsageCharge({
    usage: params.usage,
    pricing: params.pricing,
  });
  const event: UsageEvent = {
    id: `usage_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    requestId: params.requestId,
    clientId: params.clientId ?? null,
    assistantId: params.assistantId ?? null,
    billingTier: params.billingTier ?? null,
    model: params.model,
    status: params.status,
    promptTokens: params.usage?.promptTokens ?? null,
    completionTokens: params.usage?.completionTokens ?? null,
    totalTokens: params.usage?.totalTokens ?? null,
    estimatedProviderCostUsd: charge.estimatedProviderCostUsd,
    estimatedChargeUsd: charge.estimatedChargeUsd,
    chargeMarkupPercent: charge.chargeMarkupPercent,
    latencyMs: params.latencyMs,
    errorCode: params.errorCode ?? null,
    errorType: params.errorType ?? null,
    errorMessage: params.errorMessage ?? null,
    httpStatus: params.httpStatus ?? null,
    errorMetadata: params.errorMetadata ?? null,
    createdAt: new Date().toISOString(),
  };

  store.events.push(event);
  await writeJson(params.filePath, store);
  return event;
}

export async function listUsageEvents(params: {
  filePath: string;
  limit: number;
  clientId?: string | null;
  assistantId?: string | null;
}): Promise<UsageEvent[]> {
  const store = await readStore(params.filePath);
  return store.events
    .filter((event) =>
      params.clientId ? event.clientId === params.clientId : true,
    )
    .filter((event) =>
      params.assistantId ? event.assistantId === params.assistantId : true,
    )
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, params.limit);
}

function addTokens(current: number, value: number | null): number {
  return current + (typeof value === "number" ? value : 0);
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function addCurrency(current: number, value: number | undefined): number {
  return roundUsd(current + (typeof value === "number" ? value : 0));
}

function estimateUsageCharge(params: {
  usage?: ChatUsage | null;
  pricing: UsagePricing;
}): {
  estimatedProviderCostUsd: number;
  estimatedChargeUsd: number;
  chargeMarkupPercent: number;
} {
  const promptTokens = params.usage?.promptTokens ?? 0;
  const completionTokens = params.usage?.completionTokens ?? 0;
  const estimatedProviderCostUsd = roundUsd(
    (promptTokens / 1_000_000) * params.pricing.inputCacheMissUsdPerMillion +
      (completionTokens / 1_000_000) * params.pricing.outputUsdPerMillion,
  );

  return {
    estimatedProviderCostUsd,
    estimatedChargeUsd: roundUsd(
      estimatedProviderCostUsd * (1 + params.pricing.markupPercent / 100),
    ),
    chargeMarkupPercent: params.pricing.markupPercent,
  };
}

export async function getUsageSummary(params: {
  filePath: string;
  clientId?: string | null;
  assistantId?: string | null;
}) {
  const store = await readStore(params.filePath);
  const events = store.events
    .filter((event) =>
      params.clientId ? event.clientId === params.clientId : true,
    )
    .filter((event) =>
      params.assistantId ? event.assistantId === params.assistantId : true,
    );

  const totals = events.reduce(
    (summary, event) => ({
      requests: summary.requests + 1,
      successfulRequests:
        summary.successfulRequests + (event.status === "success" ? 1 : 0),
      failedRequests:
        summary.failedRequests + (event.status === "error" ? 1 : 0),
      promptTokens: addTokens(summary.promptTokens, event.promptTokens),
      completionTokens: addTokens(
        summary.completionTokens,
        event.completionTokens,
      ),
      totalTokens: addTokens(summary.totalTokens, event.totalTokens),
      estimatedProviderCostUsd: addCurrency(
        summary.estimatedProviderCostUsd,
        event.estimatedProviderCostUsd,
      ),
      estimatedChargeUsd: addCurrency(
        summary.estimatedChargeUsd,
        event.estimatedChargeUsd,
      ),
      totalLatencyMs: summary.totalLatencyMs + event.latencyMs,
    }),
    {
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedProviderCostUsd: 0,
      estimatedChargeUsd: 0,
      totalLatencyMs: 0,
    },
  );

  const byClient = new Map<
    string,
    {
      clientId: string;
      requests: number;
      totalTokens: number;
      estimatedProviderCostUsd: number;
      estimatedChargeUsd: number;
    }
  >();
  const byAssistant = new Map<
    string,
    {
      assistantId: string;
      requests: number;
      totalTokens: number;
      estimatedProviderCostUsd: number;
      estimatedChargeUsd: number;
    }
  >();

  for (const event of events) {
    const clientId = event.clientId ?? "unknown";
    const client = byClient.get(clientId) ?? {
      clientId,
      requests: 0,
      totalTokens: 0,
      estimatedProviderCostUsd: 0,
      estimatedChargeUsd: 0,
    };
    client.requests += 1;
    client.totalTokens = addTokens(client.totalTokens, event.totalTokens);
    client.estimatedProviderCostUsd = addCurrency(
      client.estimatedProviderCostUsd,
      event.estimatedProviderCostUsd,
    );
    client.estimatedChargeUsd = addCurrency(
      client.estimatedChargeUsd,
      event.estimatedChargeUsd,
    );
    byClient.set(clientId, client);

    const assistantId = event.assistantId ?? "none";
    const assistant = byAssistant.get(assistantId) ?? {
      assistantId,
      requests: 0,
      totalTokens: 0,
      estimatedProviderCostUsd: 0,
      estimatedChargeUsd: 0,
    };
    assistant.requests += 1;
    assistant.totalTokens = addTokens(assistant.totalTokens, event.totalTokens);
    assistant.estimatedProviderCostUsd = addCurrency(
      assistant.estimatedProviderCostUsd,
      event.estimatedProviderCostUsd,
    );
    assistant.estimatedChargeUsd = addCurrency(
      assistant.estimatedChargeUsd,
      event.estimatedChargeUsd,
    );
    byAssistant.set(assistantId, assistant);
  }

  return {
    ...totals,
    averageLatencyMs:
      totals.requests > 0
        ? Math.round(totals.totalLatencyMs / totals.requests)
        : 0,
    byClient: [...byClient.values()].sort(
      (left, right) => right.totalTokens - left.totalTokens,
    ),
    byAssistant: [...byAssistant.values()].sort(
      (left, right) => right.totalTokens - left.totalTokens,
    ),
  };
}
