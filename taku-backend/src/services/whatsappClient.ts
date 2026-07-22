import { config } from "../config.js";
import { ApiError } from "../http.js";

function logWaClientError(event: string, details: Record<string, unknown>) {
  console.error(JSON.stringify({ event, ...details }));
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  if (!config.takuWaApiKey) {
    throw new ApiError({
      status: 503,
      code: "WHATSAPP_SERVICE_UNAVAILABLE",
      message: "TAKU_WA_API_KEY no esta configurado.",
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(
      `${config.takuWaBaseUrl.replace(/\/+$/, "")}${path}`,
      {
        ...init,
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": config.takuWaApiKey,
          "x-client-domain": config.takuWaClientDomain,
          ...(init?.headers ?? {}),
        },
      },
    );
  } catch (error) {
    logWaClientError("taku_backend_wa_request_failed", {
      method: init?.method ?? "GET",
      path,
      baseUrl: config.takuWaBaseUrl,
      cause:
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "network_error",
      message: error instanceof Error ? error.message : String(error),
    });
    throw new ApiError({
      status: 502,
      code: "WHATSAPP_SERVICE_ERROR",
      message: "Error al comunicarse con WhatsApp Service.",
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
    logWaClientError("taku_backend_wa_response_error", {
      method: init?.method ?? "GET",
      path,
      baseUrl: config.takuWaBaseUrl,
      status: response.status,
      payload,
    });
    throw new ApiError({
      status: 502,
      code: "WHATSAPP_SERVICE_ERROR",
      message: "Error al comunicarse con WhatsApp Service.",
      details: { status: response.status, payload },
    });
  }
  return payload;
}

export const whatsappClient = {
  async getAccountMe() {
    return request("/v1/account/me");
  },

  async listConnections() {
    return request("/v1/account/connections");
  },

  async createConnection(params: {
    connectionId: string;
    businessId: string;
    label: string;
    autoStart?: boolean;
  }) {
    return request("/v1/connections", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async startConnection(connectionId: string) {
    return request(
      `/v1/connections/${encodeURIComponent(connectionId)}/start`,
      {
        method: "POST",
      },
    );
  },

  async getConnectionStatus(connectionId: string) {
    const payload = await request(
      `/v1/connections/${encodeURIComponent(connectionId)}/status`,
    );
    if (
      payload &&
      typeof payload === "object" &&
      "connection" in payload &&
      payload.connection &&
      typeof payload.connection === "object"
    ) {
      return payload.connection as {
        connected?: boolean;
        connection?: "connecting" | "open" | "close";
        hasQr?: boolean;
        phone?: string | null;
        state?: string;
      };
    }
    return null;
  },

  async stopConnection(connectionId: string) {
    return request(`/v1/connections/${encodeURIComponent(connectionId)}/stop`, {
      method: "POST",
    });
  },

  async getConnectionQr(connectionId: string) {
    const payload = await request(
      `/v1/connections/${encodeURIComponent(connectionId)}/qr`,
    );
    if (payload && typeof payload === "object") {
      return payload as {
        qr?: string | null;
        qrImage?: string | null;
        payload?: string;
        imageUrl?: string;
        imageBase64?: string;
        expiresAt?: string;
      };
    }
    return {};
  },

  async sendTextMessage(connectionId: string, to: string, text: string) {
    const payload = await request(
      `/v1/connections/${encodeURIComponent(connectionId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ to, text }),
      },
    );
    return payload as { messageId?: string; status?: string; raw?: unknown };
  },

  async createWebhookSubscription(
    url: string,
    events: string[],
    secret: string,
  ) {
    return request("/v1/webhooks/subscriptions", {
      method: "POST",
      body: JSON.stringify({ url, events, secret }),
    });
  },
};
