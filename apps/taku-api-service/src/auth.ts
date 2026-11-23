import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { AppConfig } from "./config.js";

export type RequestRole = "superowner" | "client";

export type RequestContext = {
  role: RequestRole;
  businessId: string | null;
  userId: string | null;
  name: string | null;
};

export type SessionPayload = {
  sub: string;
  name: string;
  role: RequestRole;
  businessId: string | null;
  exp: number;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function parseBearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
  config: AppConfig,
): { token: string; session: SessionPayload } {
  const session: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  };
  const encoded = base64UrlEncode(JSON.stringify(session));
  return {
    token: `${encoded}.${sign(encoded, config.sessionSecret)}`,
    session,
  };
}

export function verifySessionToken(
  token: string,
  config: AppConfig,
): SessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded, config.sessionSecret);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "superowner" && payload.role !== "client") ||
      (typeof payload.businessId !== "string" && payload.businessId !== null) ||
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function getRequestContext(
  req: Request,
  config?: AppConfig,
): RequestContext {
  const token = config ? parseBearerToken(req) : null;
  const session = token ? verifySessionToken(token, config as AppConfig) : null;
  if (session) {
    return {
      role: session.role,
      businessId: session.businessId,
      userId: session.sub,
      name: session.name,
    };
  }

  const roleHeader = req.header("x-taku-role");
  const role: RequestRole =
    roleHeader === "superowner" ? "superowner" : "client";
  const businessId = req.header("x-taku-business-id")?.trim() || null;

  return {
    role,
    businessId:
      role === "superowner" ? businessId : (businessId ?? "business_001"),
    userId: null,
    name: null,
  };
}

export function ensureServiceAccess(
  req: Request,
  res: Response,
  config: AppConfig,
): boolean {
  if (req.method === "POST" && req.path === "/v1/billing/mercadopago/webhook") {
    return true;
  }

  if (!config.apiKey) return true;

  if (req.header("x-api-key") === config.apiKey) {
    return true;
  }

  res.status(401).json({ ok: false, error: "Invalid API key" });
  return false;
}

export function canAccessBusiness(
  context: RequestContext,
  businessId: string,
): boolean {
  return context.role === "superowner" || context.businessId === businessId;
}
