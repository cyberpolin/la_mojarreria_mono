import type { AppConfig } from "./config.js";

export type WaServiceState =
  | "INACTIVE"
  | "STARTING"
  | "ACTIVE"
  | "STOPPING"
  | "ERROR";

export type WaServiceConnection = {
  connectionId: string;
  businessId: string | null;
  label: string | null;
  active: boolean;
  connected: boolean;
  connection: "connecting" | "open" | "close";
  hasQr: boolean;
  phone: string | null;
  state: WaServiceState;
  lastChangedAt: string;
};

export type WaServiceQr = {
  connection: WaServiceConnection;
  qr: string | null;
  qrImage: string | null;
};

type WaServiceResponse<T> = T & {
  ok: boolean;
  error?: string;
};

export class WaServiceClient {
  constructor(private readonly config: AppConfig) {}

  async createConnection(params: {
    connectionId: string;
    businessId: string;
    label: string;
  }): Promise<WaServiceConnection> {
    const body = await this.request<{ connection: WaServiceConnection }>(
      "/v1/connections",
      {
        method: "POST",
        body: JSON.stringify({
          connectionId: params.connectionId,
          businessId: params.businessId,
          label: params.label,
          autoStart: false,
        }),
      },
    );

    return body.connection;
  }

  async startConnection(connectionId: string): Promise<WaServiceConnection> {
    const body = await this.request<{ connection: WaServiceConnection }>(
      `/v1/connections/${encodeURIComponent(connectionId)}/start`,
      { method: "POST" },
    );

    return body.connection;
  }

  async stopConnection(connectionId: string): Promise<WaServiceConnection> {
    const body = await this.request<{ connection: WaServiceConnection }>(
      `/v1/connections/${encodeURIComponent(connectionId)}/stop`,
      { method: "POST" },
    );

    return body.connection;
  }

  async resetConnectionSession(
    connectionId: string,
  ): Promise<WaServiceConnection> {
    const body = await this.request<{ connection: WaServiceConnection }>(
      `/v1/connections/${encodeURIComponent(connectionId)}/reset-session`,
      { method: "POST" },
    );

    return body.connection;
  }

  async getConnectionStatus(
    connectionId: string,
  ): Promise<WaServiceConnection> {
    const body = await this.request<{ connection: WaServiceConnection }>(
      `/v1/connections/${encodeURIComponent(connectionId)}/status`,
    );

    return body.connection;
  }

  async getConnectionQr(connectionId: string): Promise<WaServiceQr> {
    const body = await this.request<WaServiceQr>(
      `/v1/connections/${encodeURIComponent(connectionId)}/qr`,
    );

    return {
      connection: body.connection,
      qr: body.qr,
      qrImage: body.qrImage,
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<WaServiceResponse<T>> {
    if (!this.config.waServiceApiKey) {
      throw new Error("WA_SERVICE_API_KEY is not configured");
    }

    const response = await fetch(`${this.config.waServiceBaseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.waServiceApiKey,
        "x-client-domain": this.config.waServiceClientDomain,
        ...(init.headers ?? {}),
      },
    });
    const body = (await response
      .json()
      .catch(() => null)) as WaServiceResponse<T> | null;

    if (!response.ok || !body?.ok) {
      throw new Error(
        body?.error ?? `WA service request failed with ${response.status}`,
      );
    }

    return body;
  }
}

export function mapWaServiceState(
  connection: WaServiceConnection,
): "inactive" | "starting" | "qr_pending" | "connected" | "error" {
  if (!connection.active) return "inactive";
  if (connection.connected) return "connected";
  if (connection.state === "ERROR") return "error";
  if (connection.hasQr) return "qr_pending";
  if (connection.state === "STARTING") return "starting";
  return "inactive";
}
