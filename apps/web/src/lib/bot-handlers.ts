import { buildAuthHeaders } from "@/lib/web-auth.server";
import {
  BotHandlerConfigRecord,
  BotHandlerInput,
  BotHandlersPayload,
} from "@/types/bot-handler";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type RawBotHandlerConfig = Omit<BotHandlerConfigRecord, "hasApiKeySecret"> & {
  apiKeySecret?: string | null;
};

const getEndpoint = () =>
  process.env.KEYSTONE_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
  "http://localhost:3000/api/graphql";

async function execute<T>(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed (${response.status})`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Unknown GraphQL error");
  }
  if (!payload.data) throw new Error("Missing data in GraphQL response");
  return payload.data;
}

const BOT_HANDLER_FIELDS = `
  id
  name
  provider
  enabled
  baseUrl
  webhookUrl
  apiKeySecret
  settings
  createdAt
  updatedAt
`;

const normalizeHandler = (
  handler: RawBotHandlerConfig,
): BotHandlerConfigRecord => ({
  id: handler.id,
  name: handler.name,
  provider: handler.provider,
  enabled: handler.enabled,
  baseUrl: handler.baseUrl ?? "",
  webhookUrl: handler.webhookUrl ?? "",
  hasApiKeySecret: Boolean(handler.apiKeySecret?.trim()),
  settings:
    handler.settings && typeof handler.settings === "object"
      ? handler.settings
      : {},
  createdAt: handler.createdAt,
  updatedAt: handler.updatedAt,
});

const parseSettings = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const buildData = (input: BotHandlerInput, includeSecret: boolean) => {
  const data: Record<string, unknown> = {
    name: input.name.trim(),
    provider: input.provider,
    enabled: input.enabled,
    baseUrl: input.baseUrl?.trim() ?? "",
    webhookUrl: input.webhookUrl?.trim() ?? "",
    settings: parseSettings(input.settings),
  };

  if (includeSecret) {
    data.apiKeySecret = input.apiKeySecret?.trim() ?? "";
  }

  return data;
};

export const getBotHandlers = async (): Promise<BotHandlersPayload> => {
  const query = `
    query BotHandlers {
      botHandlerConfigs(orderBy: [{ updatedAt: desc }], take: 100) {
        ${BOT_HANDLER_FIELDS}
      }
    }
  `;
  const data = await execute<{ botHandlerConfigs: RawBotHandlerConfig[] }>(
    query,
  );

  return {
    handlers: (data.botHandlerConfigs ?? []).map(normalizeHandler),
  };
};

export const createBotHandler = async (input: BotHandlerInput) => {
  const mutation = `
    mutation CreateBotHandler($data: BotHandlerConfigCreateInput!) {
      createBotHandlerConfig(data: $data) { id }
    }
  `;

  await execute(mutation, {
    data: buildData(input, true),
  });
};

export const updateBotHandler = async (id: string, input: BotHandlerInput) => {
  const mutation = `
    mutation UpdateBotHandler(
      $where: BotHandlerConfigWhereUniqueInput!
      $data: BotHandlerConfigUpdateInput!
    ) {
      updateBotHandlerConfig(where: $where, data: $data) { id }
    }
  `;

  await execute(mutation, {
    where: { id },
    data: buildData(input, Boolean(input.apiKeySecret?.trim())),
  });
};

export const deleteBotHandler = async (id: string) => {
  const mutation = `
    mutation DeleteBotHandler($where: BotHandlerConfigWhereUniqueInput!) {
      deleteBotHandlerConfig(where: $where) { id }
    }
  `;
  await execute(mutation, { where: { id } });
};

export const getBotHandlerForDelivery = async (id: string) => {
  const query = `
    query BotHandlerForDelivery($where: BotHandlerConfigWhereUniqueInput!) {
      botHandlerConfig(where: $where) {
        id
        name
        enabled
        webhookUrl
        apiKeySecret
      }
    }
  `;
  const data = await execute<{
    botHandlerConfig: {
      id: string;
      name: string;
      enabled: boolean;
      webhookUrl: string | null;
      apiKeySecret?: string | null;
    } | null;
  }>(query, { where: { id } });

  return data.botHandlerConfig;
};

export const testBotHandlerWebhook = async (webhookUrl: string) => {
  const url = new URL(webhookUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("webhookUrl must be http or https");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "bot_handler.test",
        source: "mojarreria-web",
        sentAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
  } finally {
    clearTimeout(timeout);
  }
};
