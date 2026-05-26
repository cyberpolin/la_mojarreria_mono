import { Context } from ".keystone/types";
import { Express } from "express";
import type { Prisma } from "@prisma/client";
import { routeFactory } from "../utils/withCtx";

const STATES = ["INACTIVE", "STARTING", "ACTIVE", "STOPPING", "ERROR"] as const;

type WaServiceState = (typeof STATES)[number];

type StatusPayload = {
  service: string;
  instanceId: string;
  state: WaServiceState;
  active: boolean;
  connected: boolean;
  reason: string;
  changedAt: string;
};

type RemoteWaServiceStatus = {
  active: boolean;
  connected: boolean;
  state: WaServiceState;
  lastChangedAt: string;
};

function getWebhookSecret(): string | null {
  return (
    process.env.WA_SERVICE_WEBHOOK_SECRET?.trim() ||
    process.env.MAIN_BACKEND_WEBHOOK_SECRET?.trim() ||
    null
  );
}

function getControlApiKey(): string | null {
  return process.env.WA_SERVICE_CONTROL_API_KEY?.trim() || null;
}

function getWaServiceConfig(): {
  baseUrl: string;
  apiKey: string;
  clientDomain: string;
} | null {
  const baseUrl = process.env.WA_SERVICE_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey =
    process.env.WA_SERVICE_API_KEY?.trim() ||
    process.env.SERVICE_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return null;
  }

  return {
    baseUrl,
    apiKey,
    clientDomain:
      process.env.WA_SERVICE_CLIENT_DOMAIN?.trim() || "lamojarreria.com",
  };
}

function parseBody(body: unknown): StatusPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const state = record.state;

  if (typeof state !== "string" || !STATES.includes(state as WaServiceState)) {
    return null;
  }

  if (typeof record.active !== "boolean") {
    return null;
  }

  if (typeof record.connected !== "boolean") {
    return null;
  }

  return {
    service:
      typeof record.service === "string" && record.service.trim()
        ? record.service.trim()
        : "wa-service",
    instanceId:
      typeof record.instanceId === "string" && record.instanceId.trim()
        ? record.instanceId.trim()
        : "default",
    state: state as WaServiceState,
    active: record.active,
    connected: record.connected,
    reason:
      typeof record.reason === "string" && record.reason.trim()
        ? record.reason.trim()
        : "",
    changedAt:
      typeof record.changedAt === "string" && record.changedAt.trim()
        ? record.changedAt.trim()
        : new Date().toISOString(),
  };
}

function parseChangedAt(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseRemoteStatus(body: unknown): RemoteWaServiceStatus | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const state = record.state;

  if (typeof state !== "string" || !STATES.includes(state as WaServiceState)) {
    return null;
  }

  if (typeof record.active !== "boolean") {
    return null;
  }

  if (typeof record.connected !== "boolean") {
    return null;
  }

  return {
    active: record.active,
    connected: record.connected,
    state: state as WaServiceState,
    lastChangedAt:
      typeof record.lastChangedAt === "string" && record.lastChangedAt.trim()
        ? record.lastChangedAt.trim()
        : new Date().toISOString(),
  };
}

async function upsertWaServiceStatus(
  ctx: Context,
  payload: StatusPayload,
  rawPayload: unknown,
) {
  const data = {
    state: payload.state,
    active: payload.active,
    connected: payload.connected,
    reason: payload.reason,
    lastChangedAt: parseChangedAt(payload.changedAt),
    payload: rawPayload as Prisma.InputJsonValue,
  };

  const existing = await ctx.prisma.waServiceStatus.findFirst({
    where: {
      service: payload.service,
      instanceId: payload.instanceId,
    },
    select: { id: true },
  });

  return existing
    ? ctx.prisma.waServiceStatus.update({
        where: { id: existing.id },
        data,
      })
    : ctx.prisma.waServiceStatus.create({
        data: {
          service: payload.service,
          instanceId: payload.instanceId,
          ...data,
        },
      });
}

async function callWaService(action: "activate" | "deactivate") {
  const config = getWaServiceConfig();
  if (!config) {
    throw new Error("WA_SERVICE_BASE_URL and WA_SERVICE_API_KEY are required.");
  }

  const response = await fetch(`${config.baseUrl}/service/${action}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "x-client-domain": config.clientDomain,
    },
  });
  const responseText = await response.text().catch(() => "");
  let responseBody: unknown = null;

  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  }

  if (!response.ok) {
    throw new Error(
      typeof responseBody === "string" && responseBody
        ? responseBody
        : `wa-service ${action} failed with status ${response.status}`,
    );
  }

  return responseBody;
}

function ensureControlAccess(req: {
  header(name: string): string | undefined;
}) {
  const configuredKey = getControlApiKey();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !configuredKey) {
    return {
      ok: false as const,
      status: 503,
      error: "WA_SERVICE_CONTROL_API_KEY is required in production.",
    };
  }

  if (configuredKey && req.header("x-api-key") !== configuredKey) {
    return { ok: false as const, status: 401, error: "Invalid API key." };
  }

  return { ok: true as const };
}

export default (app: Express, commonContext: Context) => {
  const router = routeFactory(app, commonContext);

  router.get("/wa-service/status", async (_req, res, ctx) => {
    const status = await ctx.prisma.waServiceStatus.findFirst({
      where: { service: "wa-service", instanceId: "default" },
      orderBy: { updatedAt: "desc" },
    });

    return res.status(200).json({ ok: true, status });
  });

  router.post("/wa-service/activate", async (req, res, ctx) => {
    const access = ensureControlAccess(req);
    if (!access.ok) {
      return res.status(access.status).json({ ok: false, error: access.error });
    }

    try {
      const remoteResponse = await callWaService("activate");
      const remoteStatus = parseRemoteStatus(remoteResponse);
      const status = remoteStatus
        ? await upsertWaServiceStatus(
            ctx,
            {
              service: "wa-service",
              instanceId: "default",
              state: remoteStatus.state,
              active: remoteStatus.active,
              connected: remoteStatus.connected,
              reason: "api_activate",
              changedAt: remoteStatus.lastChangedAt,
            },
            remoteResponse,
          )
        : null;

      return res.status(200).json({
        ok: true,
        status,
        waService: remoteResponse,
      });
    } catch (error) {
      return res.status(502).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to activate wa-service.",
      });
    }
  });

  router.post("/wa-service/deactivate", async (req, res, ctx) => {
    const access = ensureControlAccess(req);
    if (!access.ok) {
      return res.status(access.status).json({ ok: false, error: access.error });
    }

    try {
      const remoteResponse = await callWaService("deactivate");
      const remoteStatus = parseRemoteStatus(remoteResponse);
      const status = remoteStatus
        ? await upsertWaServiceStatus(
            ctx,
            {
              service: "wa-service",
              instanceId: "default",
              state: remoteStatus.state,
              active: remoteStatus.active,
              connected: remoteStatus.connected,
              reason: "api_deactivate",
              changedAt: remoteStatus.lastChangedAt,
            },
            remoteResponse,
          )
        : null;

      return res.status(200).json({
        ok: true,
        status,
        waService: remoteResponse,
      });
    } catch (error) {
      return res.status(502).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to deactivate wa-service.",
      });
    }
  });

  router.post("/wa-service/status", async (req, res, ctx) => {
    const expectedSecret = getWebhookSecret();

    if (!expectedSecret) {
      return res.status(503).json({
        ok: false,
        error: "WA_SERVICE_WEBHOOK_SECRET is required.",
      });
    }

    if (req.header("x-wa-service-webhook-secret") !== expectedSecret) {
      return res.status(401).json({ ok: false, error: "Invalid secret." });
    }

    const payload = parseBody(req.body);
    if (!payload) {
      return res.status(400).json({
        ok: false,
        error: "Invalid WhatsApp service status payload.",
      });
    }

    const status = await upsertWaServiceStatus(ctx, payload, req.body);

    return res.status(200).json({ ok: true, status });
  });
};
