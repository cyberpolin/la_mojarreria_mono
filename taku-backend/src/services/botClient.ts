import { config } from "../config.js";
import { ApiError } from "../http.js";

type AssistantPayload = {
  id: string;
  name: string;
  instructions: string;
};

type CompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CompletionPayload = {
  id?: string;
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  billing?: unknown;
};

function logBotClientError(event: string, details: Record<string, unknown>) {
  console.error(JSON.stringify({ event, ...details }));
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  if (!config.botServiceApiKey) {
    throw new ApiError({
      status: 503,
      code: "BOT_SERVICE_UNAVAILABLE",
      message: "BOT_SERVICE_API_KEY no esta configurado.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(
      `${config.botServiceBaseUrl.replace(/\/+$/, "")}${path}`,
      {
        ...init,
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.botServiceApiKey}`,
          "x-api-key": config.botServiceApiKey,
          ...(init?.headers ?? {}),
        },
      },
    );
  } catch (error) {
    logBotClientError("taku_backend_bot_request_failed", {
      method: init?.method ?? "GET",
      path,
      baseUrl: config.botServiceBaseUrl,
      cause:
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "network_error",
      message: error instanceof Error ? error.message : String(error),
    });
    throw new ApiError({
      status: 502,
      code: "BOT_SERVICE_ERROR",
      message: `No se pudo alcanzar Bot Service en ${config.botServiceBaseUrl}${path}.`,
      details: {
        cause:
          error instanceof Error && error.name === "AbortError"
            ? "timeout"
            : "network_error",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const serviceMessage =
      payload && typeof payload === "object"
        ? ((payload as { error?: unknown; message?: unknown }).error ??
          (payload as { message?: unknown }).message)
        : null;
    logBotClientError("taku_backend_bot_response_error", {
      method: init?.method ?? "GET",
      path,
      baseUrl: config.botServiceBaseUrl,
      status: response.status,
      payload,
    });
    throw new ApiError({
      status: response.status,
      code: "BOT_SERVICE_ERROR",
      message: `Bot Service respondio HTTP ${response.status}${typeof serviceMessage === "string" ? `: ${serviceMessage}` : ""}.`,
      details: { status: response.status, payload },
    });
  }
  return payload;
}

async function clientRequest(
  path: string,
  clientId: string,
  clientToken: string,
  init?: RequestInit,
): Promise<unknown> {
  return request(path, {
    ...init,
    headers: {
      authorization: `Bearer ${clientToken}`,
      "x-taku-client-id": clientId,
      "x-taku-client-token": clientToken,
      ...(init?.headers ?? {}),
    },
  });
}

function readAssistant(payload: unknown): AssistantPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const assistant = (payload as { assistant?: unknown }).assistant;
  if (!assistant || typeof assistant !== "object") return null;
  const record = assistant as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.instructions !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    instructions: record.instructions,
  };
}

export const botClient = {
  async getHealth() {
    return request("/v1/health");
  },

  async ensureClientAccount(clientId: string) {
    const payload = await request("/v1/public/accounts", {
      method: "POST",
      body: JSON.stringify({ client_id: clientId }),
    });
    const token =
      payload && typeof payload === "object"
        ? (payload as { clientToken?: unknown }).clientToken
        : null;
    return typeof token === "string" ? token : null;
  },

  async createAssistant(params: {
    clientId: string;
    clientToken: string;
    name: string;
    instructions: string;
  }) {
    const payload = await clientRequest(
      "/v1/assistants",
      params.clientId,
      params.clientToken,
      {
        method: "POST",
        body: JSON.stringify({
          name: params.name,
          instructions: params.instructions,
          client_id: params.clientId,
          client_token: params.clientToken,
        }),
      },
    );
    return readAssistant(payload);
  },

  async updateAssistant(params: {
    clientId: string;
    clientToken: string;
    assistantId: string;
    name: string;
    instructions: string;
  }) {
    const payload = await clientRequest(
      `/v1/assistants/${encodeURIComponent(params.assistantId)}`,
      params.clientId,
      params.clientToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: params.name,
          instructions: params.instructions,
          client_id: params.clientId,
          client_token: params.clientToken,
        }),
      },
    );
    return readAssistant(payload);
  },

  async createCompletion(params: {
    clientId: string;
    clientToken: string;
    assistantId: string | null;
    messages: CompletionMessage[];
    history?: CompletionMessage[];
  }) {
    const payload = await clientRequest(
      "/v1/chat/completions",
      params.clientId,
      params.clientToken,
      {
        method: "POST",
        body: JSON.stringify({
          model: "taku-cr",
          assistant_id: params.assistantId,
          client_id: params.clientId,
          client_token: params.clientToken,
          history: params.history ?? [],
          messages: params.messages,
          temperature: 0.2,
          max_tokens: 800,
        }),
      },
    );
    return payload as CompletionPayload;
  },

  syncSettings(_payload: Record<string, unknown>) {
    return Promise.resolve(null);
  },
};
