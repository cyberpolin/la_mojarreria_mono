import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  canAccessBusiness,
  createSessionToken,
  getRequestContext,
} from "./auth.js";
import type { AppConfig } from "./config.js";
import {
  createId,
  timestamps,
  touch,
  type ActiveSchedule,
  type Bot,
  type BotPhoneAssignment,
  type Business,
  type BusinessMember,
  type PaymentRecord,
  type PaymentProvider,
  type TakuData,
  type TakuStore,
  type WaConnection,
} from "./store.js";
import {
  mapWaServiceState,
  type WaServiceClient,
  type WaServiceConnection,
} from "./waServiceClient.js";

const businessSchema = z.object({
  name: z.string().trim().min(1).max(160),
  ownerName: z.string().trim().min(1).max(160),
  status: z.enum(["active", "trial", "suspended"]).default("trial"),
});

const memberSchema = z.object({
  businessId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email(),
  role: z.enum(["owner", "operator"]).default("owner"),
});

const scheduleSchema = z
  .object({
    days: z
      .array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]))
      .min(1)
      .max(7),
    startTime: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/),
    endTime: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/),
  })
  .nullable();

const waConnectionSchema = z.object({
  businessId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).default(""),
  activeSchedule: scheduleSchema.default(null),
});

const waConnectionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).optional(),
  state: z
    .enum(["inactive", "starting", "qr_pending", "connected", "error"])
    .optional(),
  activeSchedule: scheduleSchema.optional(),
});

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(150).default(80),
});

const sendChatMessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

const botSchema = z.object({
  businessId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  instructions: z.string().trim().min(1).max(8000),
  fallbackMessage: z.string().trim().max(1000).default(""),
  status: z.enum(["draft", "active", "paused"]).default("draft"),
});

const botUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  instructions: z.string().trim().min(1).max(8000).optional(),
  fallbackMessage: z.string().trim().max(1000).optional(),
  status: z.enum(["draft", "active", "paused"]).optional(),
});

const assignmentSchema = z.object({
  businessId: z.string().trim().min(1),
  botId: z.string().trim().min(1),
  waConnectionId: z.string().trim().min(1),
  active: z.boolean().default(true),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().trim().min(1),
});

const onboardingStartSchema = z.object({
  businessName: z.string().trim().min(1).max(160),
  ownerName: z.string().trim().min(1).max(160),
  email: z.string().trim().email(),
});

const billingBusinessSchema = z.object({
  businessId: z.string().trim().min(1).optional(),
});

const mercadoPagoConfirmSchema = z.object({
  businessId: z.string().trim().min(1).optional(),
  paymentId: z.string().trim().min(1),
});

const mercadoPagoCardPaymentSchema = z.object({
  businessId: z.string().trim().min(1).optional(),
  token: z.string().trim().min(1),
  payment_method_id: z.string().trim().min(1),
  issuer_id: z.union([z.string(), z.number()]).optional(),
  installments: z.coerce.number().int().positive().max(48).default(1),
  payer: z.object({
    email: z.string().trim().email(),
    identification: z
      .object({
        type: z.string().trim().min(1).optional(),
        number: z.string().trim().min(1).optional(),
      })
      .optional(),
  }),
});

const mercadoPagoWebhookSchema = z.object({
  action: z.string().trim().optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]).transform((value) => String(value)),
    })
    .optional(),
  id: z.union([z.string(), z.number()]).optional(),
  resource: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  type: z.string().trim().optional(),
});

type BusinessEntitlements = {
  plan: "paid" | "trial" | "suspended";
  canUseBots: boolean;
  canCreateBot: boolean;
  botLimit: number | null;
  botsUsed: number;
  canUseSchedules: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  blockedReason: string | null;
};

function scoped<T extends { businessId: string }>(
  records: T[],
  context: ReturnType<typeof getRequestContext>,
): T[] {
  if (context.role === "superowner") {
    return context.businessId
      ? records.filter((record) => record.businessId === context.businessId)
      : records;
  }

  return records.filter((record) => record.businessId === context.businessId);
}

function requireBusinessAccess(
  req: Request,
  res: Response,
  businessId: string,
  config: AppConfig,
): boolean {
  const context = getRequestContext(req, config);
  if (canAccessBusiness(context, businessId)) return true;

  res.status(403).json({ ok: false, error: "Business access denied" });
  return false;
}

function findBusiness(data: TakuData, businessId: string): Business | null {
  return data.businesses.find((business) => business.id === businessId) ?? null;
}

function getBusinessEntitlements(
  data: TakuData,
  business: Business,
): BusinessEntitlements {
  const botsUsed = data.bots.filter(
    (bot) => bot.businessId === business.id,
  ).length;

  if (business.status === "suspended") {
    return {
      plan: "suspended",
      canUseBots: false,
      canCreateBot: false,
      botLimit: 0,
      botsUsed,
      canUseSchedules: false,
      trialEndsAt: null,
      trialDaysRemaining: null,
      blockedReason: "Account is suspended.",
    };
  }

  if (business.status === "active") {
    return {
      plan: "paid",
      canUseBots: true,
      canCreateBot: true,
      botLimit: null,
      botsUsed,
      canUseSchedules: true,
      trialEndsAt: null,
      trialDaysRemaining: null,
      blockedReason: null,
    };
  }

  const trialEndsAtDate = new Date(business.createdAt);
  trialEndsAtDate.setUTCDate(trialEndsAtDate.getUTCDate() + 30);
  const millisecondsRemaining = trialEndsAtDate.getTime() - Date.now();
  const trialDaysRemaining = Math.max(
    0,
    Math.ceil(millisecondsRemaining / 86_400_000),
  );
  const trialActive = millisecondsRemaining > 0;

  return {
    plan: "trial",
    canUseBots: trialActive,
    canCreateBot: trialActive && botsUsed < 1,
    botLimit: 1,
    botsUsed,
    canUseSchedules: false,
    trialEndsAt: trialEndsAtDate.toISOString(),
    trialDaysRemaining,
    blockedReason: trialActive ? null : "Trial expired.",
  };
}

function withEntitlements(data: TakuData, business: Business) {
  return {
    ...business,
    entitlements: getBusinessEntitlements(data, business),
  };
}

function getBillingBusinessId(req: Request, config: AppConfig): string | null {
  const context = getRequestContext(req, config);
  const parsed = billingBusinessSchema.safeParse(req.body);
  const bodyBusinessId = parsed.success ? parsed.data.businessId : null;

  return context.role === "superowner"
    ? (bodyBusinessId ?? context.businessId)
    : context.businessId;
}

async function markBusinessPaid(
  store: TakuStore,
  businessId: string,
): Promise<Business> {
  return store.mutate<Business>((data) => {
    const record = findBusiness(data, businessId);
    if (!record) {
      throw new Error("Business not found");
    }

    record.status = "active";
    return touch(record);
  });
}

type PaymentUpsertInput = {
  businessId: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  providerPreferenceId?: string | null;
  status: string;
  amount?: number | null;
  currency?: string | null;
  paidAt?: string | null;
  rawProviderStatus?: string | null;
};

async function upsertPaymentRecord(
  store: TakuStore,
  input: PaymentUpsertInput,
): Promise<PaymentRecord> {
  return store.mutate<PaymentRecord>((data) => {
    if (!findBusiness(data, input.businessId)) {
      throw new Error("Business not found");
    }

    const now = new Date().toISOString();
    const existing = data.payments.find(
      (payment) =>
        payment.provider === input.provider &&
        payment.providerPaymentId === input.providerPaymentId,
    );

    if (existing) {
      existing.businessId = input.businessId;
      existing.providerPreferenceId = input.providerPreferenceId ?? null;
      existing.status = input.status;
      existing.amount = input.amount ?? null;
      existing.currency = input.currency ?? null;
      existing.paidAt = input.paidAt ?? null;
      existing.rawProviderStatus = input.rawProviderStatus ?? input.status;
      existing.updatedAt = now;
      return existing;
    }

    const record: PaymentRecord = {
      id: createId("payment"),
      businessId: input.businessId,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      providerPreferenceId: input.providerPreferenceId ?? null,
      status: input.status,
      amount: input.amount ?? null,
      currency: input.currency ?? null,
      paidAt: input.paidAt ?? null,
      rawProviderStatus: input.rawProviderStatus ?? input.status,
      createdAt: now,
      updatedAt: now,
    };
    data.payments.push(record);
    return record;
  });
}

async function mercadoPagoRequest<T>(
  config: AppConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!config.mercadoPagoAccessToken) {
    throw new Error("Mercado Pago access token is not configured");
  }

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.mercadoPagoAccessToken}`,
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | T
    | null;

  if (!response.ok) {
    throw new Error(
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : body &&
            typeof body === "object" &&
            "error" in body &&
            typeof body.error === "string"
          ? body.error
          : `Mercado Pago request failed with ${response.status}`,
    );
  }

  return body as T;
}

type MercadoPagoPayment = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  preference_id?: string | null;
  date_approved?: string | null;
};

function parseMercadoPagoSignature(header: string | undefined): {
  ts: string;
  v1: string;
} | null {
  if (!header) return null;

  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );

  if (!parts.ts || !parts.v1) return null;
  return { ts: parts.ts, v1: parts.v1 };
}

function verifyMercadoPagoWebhookSignature(
  req: Request,
  paymentId: string,
  config: AppConfig,
): boolean {
  if (!config.mercadoPagoWebhookSecret) return true;

  const requestId = req.header("x-request-id");
  const signature = parseMercadoPagoSignature(req.header("x-signature"));
  if (!requestId || !signature) return false;

  const manifest = `id:${paymentId};request-id:${requestId};ts:${signature.ts};`;
  const expected = createHmac("sha256", config.mercadoPagoWebhookSecret)
    .update(manifest)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature.v1);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function getMercadoPagoWebhookPaymentId(req: Request): string | null {
  const parsed = mercadoPagoWebhookSchema.safeParse(req.body);
  const bodyPaymentId = parsed.success
    ? (parsed.data.data?.id ??
      (parsed.data.topic === "payment" || parsed.data.type === "payment"
        ? parsed.data.id
        : null))
    : null;
  if (bodyPaymentId) return String(bodyPaymentId);

  const dataId = req.query["data.id"];
  if (typeof dataId === "string" && dataId.trim()) return dataId.trim();

  const id = req.query.id;
  const topic = req.query.topic ?? req.query.type;
  if (typeof id === "string" && id.trim() && topic === "payment") {
    return id.trim();
  }

  return null;
}

async function activateApprovedMercadoPagoPayment(
  store: TakuStore,
  config: AppConfig,
  paymentId: string,
  expectedBusinessId?: string | null,
): Promise<{ business: Business; payment: PaymentRecord }> {
  const payment = await mercadoPagoRequest<MercadoPagoPayment>(
    config,
    `/v1/payments/${encodeURIComponent(paymentId)}`,
  );

  const businessId = payment.external_reference ?? expectedBusinessId ?? null;
  if (!businessId) {
    throw new Error("Payment does not include a TAKU business reference");
  }

  if (expectedBusinessId && businessId !== expectedBusinessId) {
    throw new Error("Payment does not belong to this business");
  }

  if (payment.status !== "approved") {
    throw new Error(`Payment is ${payment.status}`);
  }

  const storedPayment = await upsertPaymentRecord(store, {
    businessId,
    provider: "mercadopago",
    providerPaymentId: String(payment.id),
    providerPreferenceId: payment.preference_id ?? null,
    status: payment.status,
    amount: payment.transaction_amount ?? null,
    currency: payment.currency_id ?? null,
    paidAt: payment.date_approved ?? new Date().toISOString(),
    rawProviderStatus: payment.status_detail ?? payment.status,
  });
  const business = await markBusinessPaid(store, businessId);

  return { business, payment: storedPayment };
}

function syncWaConnectionState(
  record: WaConnection,
  waConnection: WaServiceConnection,
): WaConnection {
  record.state = mapWaServiceState(waConnection);
  record.phone = waConnection.phone;
  return touch(record);
}

export function createV1Router(params: {
  config: AppConfig;
  store: TakuStore;
  waServiceClient: WaServiceClient;
}): Router {
  const router = Router();

  router.post("/session/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, issues: parsed.error.flatten() });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    if (
      email === params.config.superownerEmail.toLowerCase() &&
      parsed.data.password === params.config.superownerPassword
    ) {
      const result = createSessionToken(
        {
          sub: "superowner",
          name: "TAKU Superowner",
          role: "superowner",
          businessId: null,
        },
        params.config,
      );
      res.json({ ok: true, token: result.token, session: result.session });
      return;
    }

    const data = await params.store.list();
    const member = data.members.find(
      (item) => item.email.toLowerCase() === email && item.active,
    );
    if (!member || parsed.data.password !== params.config.clientPassword) {
      res.status(401).json({ ok: false, error: "Invalid email or password" });
      return;
    }

    const result = createSessionToken(
      {
        sub: member.id,
        name: member.name,
        role: "client",
        businessId: member.businessId,
      },
      params.config,
    );
    res.json({ ok: true, token: result.token, session: result.session });
  });

  router.post("/session/onboarding-start", async (req, res) => {
    const parsed = onboardingStartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, issues: parsed.error.flatten() });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const result = await params.store
      .mutate<{
        business: Business;
        member: BusinessMember;
      }>((data) => {
        const existingMember = data.members.find(
          (item) => item.email.toLowerCase() === email && item.active,
        );
        if (existingMember) {
          throw new Error("Email already has an active TAKU user");
        }

        const business: Business = {
          id: createId("business"),
          name: parsed.data.businessName,
          ownerName: parsed.data.ownerName,
          status: "trial",
          ...timestamps(),
        };
        const member: BusinessMember = {
          id: createId("member"),
          businessId: business.id,
          name: parsed.data.ownerName,
          email,
          role: "owner",
          active: true,
          ...timestamps(),
        };
        data.businesses.push(business);
        data.members.push(member);
        return { business, member };
      })
      .catch((error: unknown) => {
        res.status(409).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to create onboarding user",
        });
        return null;
      });

    if (!result) return;

    const session = createSessionToken(
      {
        sub: result.member.id,
        name: result.member.name,
        role: "client",
        businessId: result.business.id,
      },
      params.config,
    );

    res.status(201).json({
      ok: true,
      business: withEntitlements(await params.store.list(), result.business),
      member: result.member,
      token: session.token,
      session: session.session,
    });
  });

  router.get("/me", async (req, res) => {
    const context = getRequestContext(req, params.config);
    const data = await params.store.list();
    const business = context.businessId
      ? findBusiness(data, context.businessId)
      : null;

    res.json({
      ok: true,
      context,
      business: business ? withEntitlements(data, business) : null,
    });
  });

  router.get("/runtime/status", (req, res) => {
    const statusPassword = req.header("x-taku-status-password") ?? "";
    if (statusPassword !== params.config.superownerPassword) {
      res.status(403).json({
        ok: false,
        error: "TAKU superowner password required",
      });
      return;
    }

    const configured = (value: string | null | undefined) => Boolean(value);

    res.json({
      ok: true,
      service: "taku-api-service",
      checkedAt: new Date().toISOString(),
      runtime: {
        host: params.config.host,
        port: params.config.port,
        dataFile: params.config.dataFile,
        allowedOrigins: params.config.allowedOrigins,
        waServiceBaseUrl: params.config.waServiceBaseUrl,
        waServiceClientDomain: params.config.waServiceClientDomain,
        takuWebBaseUrl: params.config.takuWebBaseUrl,
        mercadoPagoUseSandbox: params.config.mercadoPagoUseSandbox,
      },
      variables: [
        {
          name: "TAKU_API_KEY",
          configured: configured(params.config.apiKey),
          required: true,
        },
        {
          name: "TAKU_SESSION_SECRET",
          configured: configured(params.config.sessionSecret),
          required: true,
        },
        {
          name: "TAKU_SUPEROWNER_EMAIL",
          configured: configured(params.config.superownerEmail),
          required: true,
        },
        {
          name: "TAKU_SUPEROWNER_PASSWORD",
          configured: configured(params.config.superownerPassword),
          required: true,
        },
        {
          name: "TAKU_CLIENT_PASSWORD",
          configured: configured(params.config.clientPassword),
          required: true,
        },
        {
          name: "WA_SERVICE_BASE_URL",
          configured: configured(params.config.waServiceBaseUrl),
          required: true,
        },
        {
          name: "WA_SERVICE_API_KEY",
          configured: configured(params.config.waServiceApiKey),
          required: true,
        },
        {
          name: "WA_SERVICE_CLIENT_DOMAIN",
          configured: configured(params.config.waServiceClientDomain),
          required: true,
        },
        {
          name: "TAKU_WEB_BASE_URL",
          configured: configured(params.config.takuWebBaseUrl),
          required: true,
        },
        {
          name: "MERCADOPAGO_ACCESS_TOKEN",
          configured: configured(params.config.mercadoPagoAccessToken),
          required: true,
        },
        {
          name: "MERCADOPAGO_WEBHOOK_SECRET",
          configured: configured(params.config.mercadoPagoWebhookSecret),
          required: true,
        },
      ],
    });
  });

  router.get("/businesses", async (req, res) => {
    const data = await params.store.list();
    const context = getRequestContext(req, params.config);
    const businesses =
      context.role === "superowner"
        ? data.businesses
        : data.businesses.filter(
            (business) => business.id === context.businessId,
          );

    res.json({
      ok: true,
      businesses: businesses.map((business) =>
        withEntitlements(data, business),
      ),
    });
  });

  router.post("/businesses", async (req, res) => {
    const context = getRequestContext(req, params.config);
    if (context.role !== "superowner") {
      res.status(403).json({ ok: false, error: "Superowner role required" });
      return;
    }

    const parsed = businessSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, issues: parsed.error.flatten() });
      return;
    }

    const business = await params.store.mutate<Business>((data) => {
      const record: Business = {
        id: createId("business"),
        ...parsed.data,
        ...timestamps(),
      };
      data.businesses.push(record);
      return record;
    });

    const data = await params.store.list();
    res
      .status(201)
      .json({ ok: true, business: withEntitlements(data, business) });
  });

  router.post("/billing/mock-payment", async (req, res) => {
    const context = getRequestContext(req, params.config);
    const businessId = getBillingBusinessId(req, params.config);

    if (!businessId) {
      res.status(400).json({ ok: false, error: "Business is required" });
      return;
    }

    if (!canAccessBusiness(context, businessId)) {
      res.status(403).json({ ok: false, error: "Business access denied" });
      return;
    }

    const payment = await upsertPaymentRecord(params.store, {
      businessId,
      provider: "mock",
      providerPaymentId: createId("mock_payment"),
      status: "paid",
      amount: 99,
      currency: "MXN",
      paidAt: new Date().toISOString(),
      rawProviderStatus: "paid",
    }).catch((error: unknown) => {
      res.status(404).json({
        ok: false,
        error: error instanceof Error ? error.message : "Payment failed",
      });
      return null;
    });
    if (!payment) return;

    const business = await markBusinessPaid(params.store, businessId).catch(
      (error: unknown) => {
        res.status(404).json({
          ok: false,
          error: error instanceof Error ? error.message : "Payment failed",
        });
        return null;
      },
    );

    if (!business) return;

    const data = await params.store.list();
    res.json({
      ok: true,
      business: withEntitlements(data, business),
      payment,
    });
  });

  router.post("/billing/mercadopago/preference", async (req, res) => {
    const context = getRequestContext(req, params.config);
    const businessId = getBillingBusinessId(req, params.config);

    if (!businessId) {
      res.status(400).json({ ok: false, error: "Business is required" });
      return;
    }

    if (!canAccessBusiness(context, businessId)) {
      res.status(403).json({ ok: false, error: "Business access denied" });
      return;
    }

    const data = await params.store.list();
    const business = findBusiness(data, businessId);
    if (!business) {
      res.status(404).json({ ok: false, error: "Business not found" });
      return;
    }

    try {
      const baseReturnUrl = new URL("/payment", params.config.takuWebBaseUrl);
      baseReturnUrl.searchParams.set("businessId", businessId);

      const successUrl = new URL(baseReturnUrl);
      successUrl.searchParams.set("mp_return", "success");
      const failureUrl = new URL(baseReturnUrl);
      failureUrl.searchParams.set("mp_return", "failure");
      const pendingUrl = new URL(baseReturnUrl);
      pendingUrl.searchParams.set("mp_return", "pending");
      const preferencePayload: Record<string, unknown> = {
        items: [
          {
            id: "taku-paid-monthly",
            title: "TAKU Paid Monthly",
            description:
              "WhatsApp automation with unlimited bots and schedules.",
            quantity: 1,
            currency_id: "MXN",
            unit_price: 99,
          },
        ],
        back_urls: {
          success: successUrl.toString(),
          failure: failureUrl.toString(),
          pending: pendingUrl.toString(),
        },
        external_reference: businessId,
        metadata: {
          business_id: businessId,
          business_name: business.name,
        },
      };

      if (successUrl.protocol === "https:") {
        preferencePayload.auto_return = "approved";
      }

      const preference = await mercadoPagoRequest<{
        id: string;
        init_point?: string;
        sandbox_init_point?: string;
      }>(params.config, "/checkout/preferences", {
        method: "POST",
        body: JSON.stringify(preferencePayload),
      });
      const checkoutUrl = params.config.mercadoPagoUseSandbox
        ? (preference.sandbox_init_point ?? preference.init_point)
        : (preference.init_point ?? preference.sandbox_init_point);

      if (!checkoutUrl) {
        throw new Error("Mercado Pago did not return a checkout URL");
      }

      res.json({
        ok: true,
        preference: {
          id: preference.id,
          checkoutUrl,
        },
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Mercado Pago preference",
      });
    }
  });

  router.post("/billing/mercadopago/confirm", async (req, res) => {
    const parsed = mercadoPagoConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, issues: parsed.error.flatten() });
      return;
    }

    const context = getRequestContext(req, params.config);
    const businessId =
      context.role === "superowner"
        ? (parsed.data.businessId ?? context.businessId)
        : context.businessId;

    if (!businessId) {
      res.status(400).json({ ok: false, error: "Business is required" });
      return;
    }

    if (!canAccessBusiness(context, businessId)) {
      res.status(403).json({ ok: false, error: "Business access denied" });
      return;
    }

    try {
      const { business, payment } = await activateApprovedMercadoPagoPayment(
        params.store,
        params.config,
        parsed.data.paymentId,
        businessId,
      );
      const data = await params.store.list();
      res.json({
        ok: true,
        business: withEntitlements(data, business),
        payment,
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm Mercado Pago payment",
      });
    }
  });

  router.post("/billing/mercadopago/card-payment", async (req, res) => {
    const parsed = mercadoPagoCardPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid Mercado Pago card payment payload",
        issues: parsed.error.flatten(),
      });
      return;
    }

    const context = getRequestContext(req, params.config);
    const businessId =
      context.role === "superowner"
        ? (parsed.data.businessId ?? context.businessId)
        : context.businessId;

    if (!businessId) {
      res.status(400).json({ ok: false, error: "Business is required" });
      return;
    }

    if (!canAccessBusiness(context, businessId)) {
      res.status(403).json({ ok: false, error: "Business access denied" });
      return;
    }

    const data = await params.store.list();
    const business = findBusiness(data, businessId);
    if (!business) {
      res.status(404).json({ ok: false, error: "Business not found" });
      return;
    }

    try {
      const payment = await mercadoPagoRequest<MercadoPagoPayment>(
        params.config,
        "/v1/payments",
        {
          method: "POST",
          headers: {
            "X-Idempotency-Key": randomUUID(),
          },
          body: JSON.stringify({
            token: parsed.data.token,
            transaction_amount: 99,
            installments: parsed.data.installments,
            payment_method_id: parsed.data.payment_method_id,
            issuer_id: parsed.data.issuer_id
              ? String(parsed.data.issuer_id)
              : undefined,
            payer: parsed.data.payer,
            description: "TAKU Paid Monthly",
            external_reference: businessId,
            metadata: {
              business_id: businessId,
              business_name: business.name,
            },
          }),
        },
      );

      const storedPayment = await upsertPaymentRecord(params.store, {
        businessId,
        provider: "mercadopago",
        providerPaymentId: String(payment.id),
        providerPreferenceId: payment.preference_id ?? null,
        status: payment.status,
        amount: payment.transaction_amount ?? 99,
        currency: payment.currency_id ?? "MXN",
        paidAt:
          payment.status === "approved"
            ? (payment.date_approved ?? new Date().toISOString())
            : null,
        rawProviderStatus: payment.status_detail ?? payment.status,
      });

      if (payment.status !== "approved") {
        res.status(402).json({
          ok: false,
          error: `Payment is ${payment.status}`,
          payment: storedPayment,
        });
        return;
      }

      const paidBusiness = await markBusinessPaid(params.store, businessId);
      const refreshedData = await params.store.list();
      res.json({
        ok: true,
        business: withEntitlements(refreshedData, paidBusiness),
        payment: storedPayment,
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Mercado Pago card payment",
      });
    }
  });

  router.post("/billing/mercadopago/webhook", async (req, res) => {
    const paymentId = getMercadoPagoWebhookPaymentId(req);
    if (!paymentId) {
      res.status(202).json({
        ok: true,
        ignored: true,
        reason: "Notification did not include a payment id",
      });
      return;
    }

    if (!verifyMercadoPagoWebhookSignature(req, paymentId, params.config)) {
      res.status(401).json({ ok: false, error: "Invalid webhook signature" });
      return;
    }

    try {
      const { business, payment } = await activateApprovedMercadoPagoPayment(
        params.store,
        params.config,
        paymentId,
      );
      const data = await params.store.list();
      res.json({
        ok: true,
        business: withEntitlements(data, business),
        payment,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to process webhook";
      if (message.startsWith("Payment is ")) {
        res.status(202).json({ ok: true, ignored: true, reason: message });
        return;
      }

      res.status(502).json({
        ok: false,
        error: message,
      });
    }
  });

  router.get("/payments", async (req, res) => {
    const data = await params.store.list();
    res.json({
      ok: true,
      payments: scoped(data.payments, getRequestContext(req, params.config)),
    });
  });

  router.get("/members", async (req, res) => {
    const data = await params.store.list();
    res.json({
      ok: true,
      members: scoped(data.members, getRequestContext(req, params.config)),
    });
  });

  router.post("/members", async (req, res) => {
    const parsed = memberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, issues: parsed.error.flatten() });
      return;
    }

    if (!requireBusinessAccess(req, res, parsed.data.businessId, params.config))
      return;

    const member = await params.store
      .mutate<BusinessMember>((data) => {
        if (!findBusiness(data, parsed.data.businessId)) {
          throw new Error("Business not found");
        }

        const record: BusinessMember = {
          id: createId("member"),
          active: true,
          ...parsed.data,
          ...timestamps(),
        };
        data.members.push(record);
        return record;
      })
      .catch((error: unknown) => {
        res.status(404).json({
          ok: false,
          error:
            error instanceof Error ? error.message : "Member create failed",
        });
        return null;
      });

    if (member) res.status(201).json({ ok: true, member });
  });

  router.get("/wa-connections", async (req, res) => {
    const data = await params.store.list();
    res.json({
      ok: true,
      waConnections: scoped(
        data.waConnections,
        getRequestContext(req, params.config),
      ),
    });
  });

  router.post("/wa-connections", async (req, res) => {
    const parsed = waConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, issues: parsed.error.flatten() });
      return;
    }

    if (!requireBusinessAccess(req, res, parsed.data.businessId, params.config))
      return;

    const waConnection = await params.store
      .mutate<WaConnection>((data) => {
        const business = findBusiness(data, parsed.data.businessId);
        if (!business) {
          throw new Error("Business not found");
        }
        const entitlement = getBusinessEntitlements(data, business);
        if (parsed.data.activeSchedule && !entitlement.canUseSchedules) {
          throw new Error("Schedules are available on paid accounts only.");
        }

        const id = createId("wa");
        const record: WaConnection = {
          id,
          businessId: parsed.data.businessId,
          connectionId: id,
          name: parsed.data.name,
          description: parsed.data.description,
          phone: null,
          state: "inactive",
          activeSchedule: parsed.data.activeSchedule as ActiveSchedule | null,
          ...timestamps(),
        };
        data.waConnections.push(record);
        return record;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : "WA connection create failed";
        res.status(404).json({
          ok: false,
          error: message,
        });
        return null;
      });

    if (waConnection) res.status(201).json({ ok: true, waConnection });
  });

  router.patch("/wa-connections/:id", async (req, res) => {
    const parsed = waConnectionUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, issues: parsed.error.flatten() });
      return;
    }

    const waConnection = await params.store
      .mutate<WaConnection>((data) => {
        const record = data.waConnections.find(
          (item) => item.id === req.params.id,
        );

        if (!record) {
          throw new Error("WA connection not found");
        }

        if (
          !canAccessBusiness(
            getRequestContext(req, params.config),
            record.businessId,
          )
        ) {
          throw new Error("Business access denied");
        }

        const business = findBusiness(data, record.businessId);
        if (!business) {
          throw new Error("Business not found");
        }
        const entitlement = getBusinessEntitlements(data, business);
        if (parsed.data.activeSchedule && !entitlement.canUseSchedules) {
          throw new Error("Schedules are available on paid accounts only.");
        }

        Object.assign(record, parsed.data);
        return touch(record);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : "WA connection update failed";
        res
          .status(
            message === "Business access denied"
              ? 403
              : message === "Schedules are available on paid accounts only."
                ? 402
                : 404,
          )
          .json({
            ok: false,
            error: message,
          });
        return null;
      });

    if (!waConnection) return;

    if (parsed.data.state === "inactive") {
      try {
        const stopped = await params.waServiceClient.stopConnection(
          waConnection.connectionId,
        );
        const updated = await params.store.mutate<WaConnection>((data) => {
          const record = data.waConnections.find(
            (item) => item.id === waConnection.id,
          );
          if (!record) {
            throw new Error("WA connection not found");
          }

          return syncWaConnectionState(record, stopped);
        });

        res.json({ ok: true, waConnection: updated });
        return;
      } catch (error) {
        res.status(502).json({
          ok: false,
          waConnection,
          error:
            error instanceof Error
              ? error.message
              : "Failed to stop WA connection",
        });
        return;
      }
    }

    res.json({ ok: true, waConnection });
  });

  router.post("/wa-connections/:id/pairing/start", async (req, res) => {
    let localRecord: WaConnection | null = null;

    const found = await params.store
      .mutate<WaConnection>((data) => {
        const record = data.waConnections.find(
          (item) => item.id === req.params.id,
        );

        if (!record) {
          throw new Error("WA connection not found");
        }

        if (
          !canAccessBusiness(
            getRequestContext(req, params.config),
            record.businessId,
          )
        ) {
          throw new Error("Business access denied");
        }

        record.state = "starting";
        localRecord = touch(record);
        return localRecord;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "WA pairing start failed";
        res.status(message === "Business access denied" ? 403 : 404).json({
          ok: false,
          error: message,
        });
        return null;
      });

    if (!found || !localRecord) return;

    try {
      await params.waServiceClient.createConnection({
        connectionId: found.connectionId,
        businessId: found.businessId,
        label: found.name,
      });
      const waConnection = await params.waServiceClient.startConnection(
        found.connectionId,
      );
      const qr = await params.waServiceClient.getConnectionQr(
        found.connectionId,
      );

      const updated = await params.store.mutate<WaConnection>((data) => {
        const record = data.waConnections.find((item) => item.id === found.id);
        if (!record) {
          throw new Error("WA connection not found");
        }

        return syncWaConnectionState(record, qr.connection ?? waConnection);
      });

      res.json({
        ok: true,
        waConnection: updated,
        pairing: {
          connection: qr.connection ?? waConnection,
          qr: qr.qr,
          qrImage: qr.qrImage,
        },
      });
    } catch (error) {
      await params.store.mutate<WaConnection>((data) => {
        const record = data.waConnections.find((item) => item.id === found.id);
        if (!record) return found;
        record.state = "error";
        return touch(record);
      });

      res.status(502).json({
        ok: false,
        waConnection: localRecord,
        error:
          error instanceof Error ? error.message : "Failed to start WA pairing",
      });
    }
  });

  router.get("/wa-connections/:id/pairing/status", async (req, res) => {
    const data = await params.store.list();
    const record = data.waConnections.find((item) => item.id === req.params.id);

    if (!record) {
      res.status(404).json({ ok: false, error: "WA connection not found" });
      return;
    }

    if (
      !canAccessBusiness(
        getRequestContext(req, params.config),
        record.businessId,
      )
    ) {
      res.status(403).json({ ok: false, error: "Business access denied" });
      return;
    }

    try {
      const waConnection = await params.waServiceClient.getConnectionStatus(
        record.connectionId,
      );
      const updated = await params.store.mutate<WaConnection>((currentData) => {
        const current = currentData.waConnections.find(
          (item) => item.id === record.id,
        );
        if (!current) {
          throw new Error("WA connection not found");
        }

        return syncWaConnectionState(current, waConnection);
      });

      res.json({ ok: true, waConnection: updated, pairing: waConnection });
    } catch (error) {
      res.status(502).json({
        ok: false,
        waConnection: record,
        error:
          error instanceof Error
            ? error.message
            : "Failed to read WA pairing status",
      });
    }
  });

  router.get("/wa-connections/:id/pairing/qr", async (req, res) => {
    const data = await params.store.list();
    const record = data.waConnections.find((item) => item.id === req.params.id);

    if (!record) {
      res.status(404).json({ ok: false, error: "WA connection not found" });
      return;
    }

    if (
      !canAccessBusiness(
        getRequestContext(req, params.config),
        record.businessId,
      )
    ) {
      res.status(403).json({ ok: false, error: "Business access denied" });
      return;
    }

    try {
      const qr = await params.waServiceClient.getConnectionQr(
        record.connectionId,
      );
      const updated = await params.store.mutate<WaConnection>((currentData) => {
        const current = currentData.waConnections.find(
          (item) => item.id === record.id,
        );
        if (!current) {
          throw new Error("WA connection not found");
        }

        return syncWaConnectionState(current, qr.connection);
      });

      res.json({ ok: true, waConnection: updated, pairing: qr });
    } catch (error) {
      res.status(502).json({
        ok: false,
        waConnection: record,
        error:
          error instanceof Error ? error.message : "Failed to read WA QR code",
      });
    }
  });

  router.get(
    "/wa-connections/by-connection/:connectionId/bot",
    async (req, res) => {
      const connectionId = req.params.connectionId?.trim();
      if (!connectionId) {
        res.status(400).json({ ok: false, error: "connectionId is required" });
        return;
      }

      const data = await params.store.list();
      const waConnection = data.waConnections.find(
        (item) => item.connectionId === connectionId,
      );

      if (!waConnection) {
        res.status(404).json({ ok: false, error: "WA connection not found" });
        return;
      }

      if (
        !canAccessBusiness(
          getRequestContext(req, params.config),
          waConnection.businessId,
        )
      ) {
        res.status(403).json({ ok: false, error: "Business access denied" });
        return;
      }

      const business = findBusiness(data, waConnection.businessId);
      const entitlement = business
        ? getBusinessEntitlements(data, business)
        : null;
      if (!entitlement?.canUseBots) {
        res.json({
          ok: true,
          waConnection,
          assignment: null,
          bot: null,
          entitlements: entitlement,
        });
        return;
      }

      const assignment = data.assignments.find(
        (item) =>
          item.waConnectionId === waConnection.id &&
          item.businessId === waConnection.businessId &&
          item.active,
      );

      const bot = assignment
        ? data.bots.find(
            (item) =>
              item.id === assignment.botId &&
              item.businessId === waConnection.businessId,
          )
        : null;

      if (!assignment || !bot || bot.status !== "active") {
        res.json({
          ok: true,
          waConnection,
          assignment: assignment ?? null,
          bot: null,
        });
        return;
      }

      res.json({
        ok: true,
        waConnection,
        assignment,
        bot: {
          id: bot.id,
          businessId: bot.businessId,
          name: bot.name,
          status: bot.status,
          instructions: bot.instructions,
          fallbackMessage: bot.fallbackMessage,
        },
      });
    },
  );

  router.post("/wa-connections/:id/pairing/unlink", async (req, res) => {
    const data = await params.store.list();
    const record = data.waConnections.find((item) => item.id === req.params.id);

    if (!record) {
      res.status(404).json({ ok: false, error: "WA connection not found" });
      return;
    }

    if (
      !canAccessBusiness(
        getRequestContext(req, params.config),
        record.businessId,
      )
    ) {
      res.status(403).json({ ok: false, error: "Business access denied" });
      return;
    }

    try {
      const waConnection = await params.waServiceClient.resetConnectionSession(
        record.connectionId,
      );
      const updated = await params.store.mutate<WaConnection>((currentData) => {
        const current = currentData.waConnections.find(
          (item) => item.id === record.id,
        );
        if (!current) {
          throw new Error("WA connection not found");
        }

        current.phone = null;
        current.state = "inactive";
        return touch(current);
      });

      res.json({
        ok: true,
        waConnection: updated,
        pairing: waConnection,
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        waConnection: record,
        error:
          error instanceof Error ? error.message : "Failed to unlink WA phone",
      });
    }
  });

  router.get("/wa-chat/conversations", async (req, res) => {
    const parsed = limitQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid query",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const context = getRequestContext(req, params.config);
    const data = await params.store.list();
    const accessibleConnections = scoped(data.waConnections, context);
    if (accessibleConnections.length === 0) {
      res.json({ ok: true, total: 0, conversations: [] });
      return;
    }

    try {
      const conversations = await params.waServiceClient.listConversations(
        parsed.data.limit,
      );
      res.json({
        ok: true,
        total: conversations.length,
        conversations,
        sync: {
          mode: "rest-polling",
          websocket: false,
        },
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load WA conversations",
      });
    }
  });

  router.get("/wa-chat/conversations/:phone/messages", async (req, res) => {
    const parsed = limitQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid query",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const context = getRequestContext(req, params.config);
    const data = await params.store.list();
    const accessibleConnections = scoped(data.waConnections, context);
    if (accessibleConnections.length === 0) {
      res.status(403).json({ ok: false, error: "Business access denied" });
      return;
    }

    try {
      const phone = req.params.phone.trim();
      const messages = await params.waServiceClient.listConversationMessages({
        phone,
        limit: parsed.data.limit,
      });
      res.json({
        ok: true,
        phone,
        total: messages.length,
        messages,
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load WA messages",
      });
    }
  });

  router.post("/wa-chat/conversations/:phone/messages", async (req, res) => {
    const parsed = sendChatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid request body",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const context = getRequestContext(req, params.config);
    const data = await params.store.list();
    const accessibleConnections = scoped(data.waConnections, context);
    if (accessibleConnections.length === 0) {
      res.status(403).json({ ok: false, error: "Business access denied" });
      return;
    }

    try {
      const result = await params.waServiceClient.sendConversationMessage({
        phone: req.params.phone.trim(),
        text: parsed.data.text,
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to send WA message",
      });
    }
  });

  router.get("/bots", async (req, res) => {
    const data = await params.store.list();
    res.json({
      ok: true,
      bots: scoped(data.bots, getRequestContext(req, params.config)),
    });
  });

  router.post("/bots", async (req, res) => {
    const parsed = botSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, issues: parsed.error.flatten() });
      return;
    }

    if (!requireBusinessAccess(req, res, parsed.data.businessId, params.config))
      return;

    const bot = await params.store
      .mutate<Bot>((data) => {
        const business = findBusiness(data, parsed.data.businessId);
        if (!business) {
          throw new Error("Business not found");
        }
        const entitlement = getBusinessEntitlements(data, business);
        if (!entitlement.canUseBots) {
          throw new Error(
            entitlement.blockedReason ?? "Bot access is not available.",
          );
        }
        if (!entitlement.canCreateBot) {
          throw new Error(
            "Trial accounts can create one bot. Upgrade to add more.",
          );
        }

        const record: Bot = {
          id: createId("bot"),
          ...parsed.data,
          ...timestamps(),
        };
        data.bots.push(record);
        return record;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Bot create failed";
        res
          .status(
            message === "Business not found"
              ? 404
              : message ===
                    "Trial accounts can create one bot. Upgrade to add more." ||
                  message === "Trial expired." ||
                  message === "Account is suspended."
                ? 402
                : 404,
          )
          .json({
            ok: false,
            error: message,
          });
        return null;
      });

    if (bot) res.status(201).json({ ok: true, bot });
  });

  router.patch("/bots/:id", async (req, res) => {
    const parsed = botUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, issues: parsed.error.flatten() });
      return;
    }

    const bot = await params.store
      .mutate<Bot>((data) => {
        const record = data.bots.find((item) => item.id === req.params.id);

        if (!record) {
          throw new Error("Bot not found");
        }

        if (
          !canAccessBusiness(
            getRequestContext(req, params.config),
            record.businessId,
          )
        ) {
          throw new Error("Business access denied");
        }

        Object.assign(record, parsed.data);
        return touch(record);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Bot update failed";
        res.status(message === "Business access denied" ? 403 : 404).json({
          ok: false,
          error: message,
        });
        return null;
      });

    if (bot) res.json({ ok: true, bot });
  });

  router.get("/bot-assignments", async (req, res) => {
    const data = await params.store.list();
    res.json({
      ok: true,
      assignments: scoped(
        data.assignments,
        getRequestContext(req, params.config),
      ),
    });
  });

  router.post("/bot-assignments", async (req, res) => {
    const parsed = assignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, issues: parsed.error.flatten() });
      return;
    }

    if (!requireBusinessAccess(req, res, parsed.data.businessId, params.config))
      return;

    const assignment = await params.store
      .mutate<BotPhoneAssignment>((data) => {
        const bot = data.bots.find(
          (item) =>
            item.id === parsed.data.botId &&
            item.businessId === parsed.data.businessId,
        );
        const waConnection = data.waConnections.find(
          (item) =>
            item.id === parsed.data.waConnectionId &&
            item.businessId === parsed.data.businessId,
        );

        if (!bot || !waConnection) {
          throw new Error("Bot or WA connection not found");
        }

        const existing = data.assignments.find(
          (item) =>
            item.botId === parsed.data.botId &&
            item.waConnectionId === parsed.data.waConnectionId,
        );

        if (existing) {
          existing.active = parsed.data.active;
          return touch(existing);
        }

        const record: BotPhoneAssignment = {
          id: createId("assignment"),
          businessId: parsed.data.businessId,
          botId: parsed.data.botId,
          waConnectionId: parsed.data.waConnectionId,
          active: parsed.data.active,
          ...timestamps(),
        };
        data.assignments.push(record);
        return record;
      })
      .catch((error: unknown) => {
        res.status(404).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Bot assignment create failed",
        });
        return null;
      });

    if (assignment) res.status(201).json({ ok: true, assignment });
  });

  return router;
}
