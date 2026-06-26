import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import QRCode from "qrcode";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { WhatsAppClient } from "../baileys/client.js";
import type { ConnectionManager } from "../connections/connectionManager.js";
import {
  getLastConversationMessage,
  listConversationMessages,
  listConversations,
  listMessages,
} from "../services/conversationStore.js";
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  deleteWebhookSubscriptionForAccount,
  listWebhookSubscriptions,
  type WebhookEventName,
} from "../services/webhookSubscriptionStore.js";
import {
  addStandaloneConnection,
  activateStandalonePreapprovalSubscription,
  completeStandaloneBillingRequest,
  completeStandalonePaymentIntent,
  createStandaloneBillingRequest,
  createStandalonePaymentMethod,
  createStandaloneConnectionId,
  createStandaloneFreeAccount,
  createStandalonePaymentIntent,
  createStandaloneSession,
  createStandaloneSessionForAccount,
  deleteStandalonePaymentMethod,
  findStandaloneAccountByApiKey,
  findStandaloneAccountBySessionToken,
  getStandaloneBillingSummary,
  getStandaloneAdminOverview,
  getStandaloneEffectiveBilling,
  getStandaloneEntitlements,
  getStandalonePaymentIntent,
  getStandaloneUsage,
  incrementStandaloneMessages,
  listStandalonePlans,
  listStandaloneUsageDays,
  rotateStandaloneAccountApiKey,
  setDefaultStandalonePaymentMethod,
  updateStandaloneSubscriptionFromProvider,
  updateStandaloneBillingRequestCheckout,
  updateStandalonePaymentIntentCheckout,
  updateStandaloneAccountProjectName,
  updateStandaloneAccountPassword,
  type StandalonePlan,
  type StandaloneAccount,
} from "../services/standaloneAccountStore.js";
import {
  createMercadoPagoCardPayment,
  createMercadoPagoPreference,
  findMercadoPagoPaymentByExternalReference,
  createMercadoPagoPreapproval,
  getMercadoPagoPreapproval,
  getMercadoPagoPayment,
  MercadoPagoRequestError,
} from "../services/mercadoPagoClient.js";
import { normalizePhone } from "../utils/phone.js";
import { validateServiceRequest } from "../utils/requestAuth.js";

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const messageStreamQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const sendMessageSchema = z.object({
  to: z.string().trim().min(10).max(20),
  text: z.string().trim().min(1).max(4000),
});

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

const createConnectionSchema = z.object({
  connectionId: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9_-]+$/, "Use only letters, numbers, _ or -")
    .default("default"),
  businessId: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  autoStart: z.boolean().optional(),
});

const webhookSubscriptionSchema = z.object({
  url: z.string().url(),
  events: z
    .array(z.enum(["message.received"]))
    .min(1)
    .default(["message.received"]),
  secret: z.string().trim().min(1).max(500).optional(),
});

const standaloneSignupSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  projectName: z.string().trim().min(1).max(160),
  password: z.string().min(8).max(200),
  paidPaymentIntentId: z.string().trim().min(1).max(80).optional(),
});

const standaloneLoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

const standaloneAccountUpdateSchema = z.object({
  projectName: z.string().trim().min(1).max(160),
});

const standalonePasswordUpdateSchema = z.object({
  password: z.string().min(8).max(200),
});

const standaloneCreateConnectionSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
});

const paidPlanSchema = z.enum(["basic", "developer", "platform", "enterprise"]);

const billingCheckoutSchema = z.object({
  plan: paidPlanSchema,
  billingCycle: z.enum(["monthly"]).default("monthly"),
  returnPath: z
    .string()
    .trim()
    .regex(/^\/[a-zA-Z0-9/_-]*$/)
    .default("/admin/billing"),
});

const publicPaymentCheckoutSchema = z.object({
  plan: paidPlanSchema,
});

const publicCardPaymentSchema = z.object({
  plan: paidPlanSchema,
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

const billingCardPaymentSchema = publicCardPaymentSchema.extend({
  billingRequestId: z.string().trim().min(1),
});

const paymentMethodSchema = z.object({
  brand: z.string().trim().min(1).max(40),
  last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(2026).max(2100),
  holderName: z.string().trim().min(1).max(120),
});

function ensureAuthorized(
  req: Request,
  res: Response,
  config: AppConfig,
): boolean {
  const authResult = validateServiceRequest(req, config);
  if (!authResult.ok) {
    res.status(authResult.status).json({ ok: false, error: authResult.error });
    return false;
  }

  return true;
}

function parsePhoneParam(req: Request, res: Response): string | null {
  try {
    return normalizePhone(req.params.phone ?? "");
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Invalid phone",
    });
    return null;
  }
}

function parseConnectionIdParam(req: Request, res: Response): string | null {
  const connectionId = req.params.connectionId?.trim();
  if (!connectionId) {
    res.status(400).json({
      ok: false,
      error: "connectionId is required",
    });
    return null;
  }

  return connectionId;
}

function isStandaloneSuperowner(account: StandaloneAccount, config: AppConfig) {
  return (
    config.takuSuperownerEmail !== null &&
    account.email.toLowerCase() === config.takuSuperownerEmail.toLowerCase()
  );
}

function publicStandaloneAccount(
  account: StandaloneAccount,
  config: AppConfig,
) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    projectName: account.projectName,
    plan: account.plan,
    isSuperowner: isStandaloneSuperowner(account, config),
    passwordSetupRequired:
      account.passwordSetupRequired ?? account.plan !== "free",
    connectionIds: account.connectionIds,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function getMonthRange(month: string): { from: string; to: string } {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function buildMonthlyUsageDays(params: {
  month: string;
  usageDays: Array<{ date: string; messagesSent: number; updatedAt: string }>;
}) {
  const usageByDate = new Map(
    params.usageDays.map((usage) => [usage.date, usage]),
  );
  const range = getMonthRange(params.month);
  const dayCount = Number(range.to.slice(-2));

  return Array.from({ length: dayCount }, (_, index) => {
    const date = `${params.month}-${String(index + 1).padStart(2, "0")}`;
    const usage = usageByDate.get(date);
    return {
      date,
      messagesSent: usage?.messagesSent ?? 0,
      updatedAt: usage?.updatedAt ?? null,
    };
  });
}

function getConnectionConversationStoreFile(
  config: AppConfig,
  connectionId: string,
) {
  return join(
    config.connectionDataRoot,
    encodeURIComponent(connectionId),
    "conversations.json",
  );
}

async function requireStandaloneAccount(
  req: Request,
  res: Response,
  config: AppConfig,
): Promise<StandaloneAccount | null> {
  const apiKey = req.header("x-api-key")?.trim();
  if (apiKey) {
    const account = await findStandaloneAccountByApiKey({
      filePath: config.standaloneAccountsFile,
      apiKey,
    });
    if (account) {
      return account;
    }
  }

  const authHeader = req.header("authorization")?.trim();
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const sessionToken = req.header("x-session-token")?.trim() ?? bearerToken;
  if (sessionToken) {
    const account = await findStandaloneAccountBySessionToken({
      filePath: config.standaloneAccountsFile,
      sessionToken,
    });
    if (account) {
      return account;
    }
  }

  res.status(401).json({
    ok: false,
    error: "Valid x-api-key or session token is required",
  });
  return null;
}

function ensureAccountConnection(
  account: StandaloneAccount,
  connectionId: string,
  res: Response,
): boolean {
  if (account.connectionIds.includes(connectionId)) {
    return true;
  }

  res.status(404).json({
    ok: false,
    error: "WhatsApp connection not found for this account",
  });
  return false;
}

function readQueryString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
    return value[0];
  }

  return null;
}

function readWebhookPaymentId(req: Request): string | null {
  const queryId =
    readQueryString(req.query["data.id"]) ?? readQueryString(req.query.id);
  if (queryId) {
    return queryId;
  }

  const body = req.body as unknown;
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const data = "data" in body ? (body as { data?: unknown }).data : null;
  if (typeof data === "object" && data !== null && "id" in data) {
    const id = (data as { id?: unknown }).id;
    return typeof id === "string" || typeof id === "number" ? String(id) : null;
  }

  return null;
}

function readWebhookType(req: Request): string | null {
  const queryType =
    readQueryString(req.query.type) ??
    readQueryString(req.query.topic) ??
    readQueryString(req.query.action);
  if (queryType) {
    return queryType;
  }

  const body = req.body as unknown;
  if (typeof body !== "object" || body === null) {
    return null;
  }

  for (const key of ["type", "topic", "action"] as const) {
    if (key in body) {
      const value = (body as Record<string, unknown>)[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  }

  return null;
}

function isPreapprovalWebhook(type: string | null): boolean {
  const normalized = type?.toLowerCase() ?? "";
  return (
    normalized.includes("preapproval") ||
    normalized.includes("subscription") ||
    normalized.includes("authorized_payment")
  );
}

function mapPreapprovalStatus(
  status: string,
): "active" | "past_due" | "cancelled" | null {
  if (status === "authorized") {
    return "active";
  }

  if (status === "paused" || status === "pending") {
    return "past_due";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  return null;
}

function validateMercadoPagoReturnBaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      ? null
      : "TAKU_WA_WEB_BASE_URL must be a public HTTPS URL for Mercado Pago return URLs";
  } catch {
    return "TAKU_WA_WEB_BASE_URL must be a valid public HTTPS URL";
  }
}

function selectMercadoPagoCheckoutUrl(params: {
  accessToken: string;
  initPoint: string;
  sandboxInitPoint: string | null;
}): string {
  return params.accessToken.startsWith("TEST-")
    ? (params.sandboxInitPoint ?? params.initPoint)
    : params.initPoint;
}

async function getEffectiveBillingForAccount(
  config: AppConfig,
  account: StandaloneAccount,
) {
  return getStandaloneEffectiveBilling({
    filePath: config.standaloneAccountsFile,
    accountId: account.id,
  });
}

async function ensurePaidBillingAccess(
  config: AppConfig,
  account: StandaloneAccount,
  res: Response,
): Promise<boolean> {
  const billing = await getEffectiveBillingForAccount(config, account);
  if (!billing.billingRestricted) {
    return true;
  }

  res.status(402).json({
    ok: false,
    error: "Subscription payment is past due. Update billing to continue.",
    upgradeRequired: true,
    subscription: billing.subscription,
    entitlements: billing.entitlements,
  });
  return false;
}

export function createV1Router(params: {
  config: AppConfig;
  whatsAppClient: WhatsAppClient;
  connectionManager: ConnectionManager;
}): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, version: "v1" });
  });

  router.post("/public/signup", async (req: Request, res: Response) => {
    const parsed = standaloneSignupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid signup payload",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const { account, apiKey, connectionId } =
        await createStandaloneFreeAccount({
          filePath: params.config.standaloneAccountsFile,
          name: parsed.data.name,
          email: parsed.data.email,
          projectName: parsed.data.projectName,
          password: parsed.data.password,
          paidPaymentIntentId: parsed.data.paidPaymentIntentId ?? null,
        });

      let connection = null;
      let qr: string | null = null;
      let qrImage: string | null = null;
      let pairingError: string | null = null;

      try {
        await params.connectionManager.createConnection({
          connectionId,
          businessId: account.id,
          label: account.projectName,
          autoStart: false,
        });
        connection = await params.connectionManager.start(
          connectionId,
          "standalone_signup_start",
        );
        qr = params.connectionManager.getLatestQr(connectionId);
        qrImage = qr
          ? await QRCode.toDataURL(qr, {
              margin: 2,
              width: 320,
              errorCorrectionLevel: "M",
            })
          : null;
      } catch (error) {
        pairingError =
          error instanceof Error
            ? error.message
            : "Failed to start WhatsApp pairing";
        connection = params.connectionManager.getSnapshot(connectionId);
      }

      const entitlements = getStandaloneEntitlements(account.plan);
      const usage = await getStandaloneUsage({
        filePath: params.config.standaloneAccountsFile,
        accountId: account.id,
      });
      const session = await createStandaloneSessionForAccount({
        filePath: params.config.standaloneAccountsFile,
        accountId: account.id,
      });

      res.status(201).json({
        ok: true,
        account: publicStandaloneAccount(account, params.config),
        apiKey,
        apiKeyNotice: "Store this API key now. It is only returned once.",
        sessionToken: session.sessionToken,
        sessionExpiresAt: session.expiresAt,
        entitlements,
        usage,
        connection,
        connectionId,
        qr,
        qrImage,
        pairingError,
      });
    } catch (error) {
      res.status(409).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create TAKU WA account",
      });
    }
  });

  router.post(
    "/public/billing/checkout",
    async (req: Request, res: Response) => {
      const parsed = publicPaymentCheckoutSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid payment payload",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const selectedPlan = listStandalonePlans().find(
        (plan) => plan.plan === parsed.data.plan,
      );
      if (!selectedPlan || selectedPlan.monthlyPriceUsd === null) {
        res.status(400).json({
          ok: false,
          error: "Choose a fixed-price paid plan",
        });
        return;
      }

      try {
        const intent = await createStandalonePaymentIntent({
          filePath: params.config.standaloneAccountsFile,
          toPlan: parsed.data.plan as StandalonePlan,
          amountUsd: selectedPlan.monthlyPriceUsd,
        });

        if (!params.config.mercadoPagoAccessToken) {
          res.status(503).json({
            ok: false,
            error: "Mercado Pago access token is not configured",
          });
          return;
        }

        const returnUrlError = validateMercadoPagoReturnBaseUrl(
          params.config.takuWaWebBaseUrl,
        );
        const canUseBackUrls = returnUrlError === null;

        const preference = await createMercadoPagoPreference({
          accessToken: params.config.mercadoPagoAccessToken,
          items: [
            {
              id: selectedPlan.plan,
              title: `TAKU WA ${selectedPlan.name}`,
              description: `${selectedPlan.name} first month`,
              quantity: 1,
              unit_price: selectedPlan.monthlyPriceUsd,
              currency_id: params.config.mercadoPagoCurrencyId,
            },
          ],
          externalReference: intent.id,
          backUrls: canUseBackUrls
            ? {
                success: `${params.config.takuWaWebBaseUrl}/payment?plan=${selectedPlan.plan}&paymentIntent=${intent.id}&payment=success`,
                failure: `${params.config.takuWaWebBaseUrl}/payment?plan=${selectedPlan.plan}&paymentIntent=${intent.id}&payment=failure`,
                pending: `${params.config.takuWaWebBaseUrl}/payment?plan=${selectedPlan.plan}&paymentIntent=${intent.id}&payment=pending`,
              }
            : null,
          notificationUrl: params.config.mercadoPagoNotificationUrl,
        });
        const checkoutUrl = selectMercadoPagoCheckoutUrl({
          accessToken: params.config.mercadoPagoAccessToken,
          initPoint: preference.initPoint,
          sandboxInitPoint: preference.sandboxInitPoint,
        });
        const updatedIntent = await updateStandalonePaymentIntentCheckout({
          filePath: params.config.standaloneAccountsFile,
          paymentIntentId: intent.id,
          providerPreferenceId: preference.id,
          checkoutUrl,
        });

        res.status(201).json({
          ok: true,
          returnUrlConfigured: canUseBackUrls,
          returnUrlWarning: canUseBackUrls ? null : returnUrlError,
          paymentIntent: updatedIntent,
          checkoutUrl: updatedIntent.checkoutUrl,
        });
      } catch (error) {
        res.status(400).json({
          ok: false,
          error:
            error instanceof Error ? error.message : "Could not create payment",
        });
      }
    },
  );

  router.post(
    "/public/billing/card-payment",
    async (req: Request, res: Response) => {
      const parsed = publicCardPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid card payment payload",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const selectedPlan = listStandalonePlans().find(
        (plan) => plan.plan === parsed.data.plan,
      );
      if (!selectedPlan || selectedPlan.monthlyPriceUsd === null) {
        res.status(400).json({
          ok: false,
          error: "Choose a fixed-price paid plan",
        });
        return;
      }

      if (!params.config.mercadoPagoAccessToken) {
        res.status(503).json({
          ok: false,
          error: "Mercado Pago access token is not configured",
        });
        return;
      }

      try {
        const intent = await createStandalonePaymentIntent({
          filePath: params.config.standaloneAccountsFile,
          toPlan: parsed.data.plan as StandalonePlan,
          amountUsd: selectedPlan.monthlyPriceUsd,
        });
        console.info("[wa billing] creating card payment", {
          paymentIntentId: intent.id,
          plan: selectedPlan.plan,
          amount: selectedPlan.monthlyPriceUsd,
          paymentMethodId: parsed.data.payment_method_id,
          installments: parsed.data.installments,
          issuerId: parsed.data.issuer_id ?? null,
          payerEmail: parsed.data.payer.email,
          hasIdentification: Boolean(parsed.data.payer.identification),
        });
        const payment = await createMercadoPagoCardPayment({
          accessToken: params.config.mercadoPagoAccessToken,
          token: parsed.data.token,
          transactionAmount: selectedPlan.monthlyPriceUsd,
          installments: parsed.data.installments,
          paymentMethodId: parsed.data.payment_method_id,
          issuerId: parsed.data.issuer_id ?? null,
          payer: parsed.data.payer,
          description: `TAKU WA ${selectedPlan.name}`,
          externalReference: intent.id,
          idempotencyKey: randomUUID(),
        });
        console.info("[wa billing] mercado pago payment response", {
          paymentIntentId: intent.id,
          providerPaymentId: payment.id,
          status: payment.status,
          statusDetail: payment.statusDetail,
          paymentMethodId: payment.paymentMethodId,
          amount: payment.transactionAmount,
          currency: payment.currencyId,
          dateApproved: payment.dateApproved,
        });

        if (payment.status !== "approved") {
          res.status(402).json({
            ok: false,
            error: `Payment is ${payment.status}`,
            paymentStatus: payment.status,
            paymentStatusDetail: payment.statusDetail,
            paymentIntent: intent,
          });
          return;
        }

        const completedIntent = await completeStandalonePaymentIntent({
          filePath: params.config.standaloneAccountsFile,
          paymentIntentId: intent.id,
          providerPaymentId: payment.id,
          paidAt: payment.dateApproved ?? new Date().toISOString(),
        });

        res.status(201).json({
          ok: true,
          paymentIntent: completedIntent,
          paymentStatus: payment.status,
        });
      } catch (error) {
        if (error instanceof MercadoPagoRequestError) {
          console.error("[wa billing] mercado pago card payment failed", {
            status: error.status,
            error: error.error,
            message: error.message,
            causes: error.causes,
            plan: parsed.data.plan,
            paymentMethodId: parsed.data.payment_method_id,
            installments: parsed.data.installments,
            issuerId: parsed.data.issuer_id ?? null,
            payerEmail: parsed.data.payer.email,
            hasIdentification: Boolean(parsed.data.payer.identification),
          });
          res.status(400).json({
            ok: false,
            error: error.message,
            providerStatus: error.status,
            providerError: error.error,
            providerCauses: error.causes,
          });
          return;
        }

        console.error("[wa billing] card payment failed", {
          error: error instanceof Error ? error.message : String(error),
          plan: parsed.data.plan,
          paymentMethodId: parsed.data.payment_method_id,
          installments: parsed.data.installments,
          issuerId: parsed.data.issuer_id ?? null,
          payerEmail: parsed.data.payer.email,
          hasIdentification: Boolean(parsed.data.payer.identification),
        });
        res.status(400).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not process card payment",
        });
      }
    },
  );

  router.get(
    "/public/billing/intents/:paymentIntentId",
    async (req: Request, res: Response) => {
      const paymentIntentId = req.params.paymentIntentId?.trim();
      if (!paymentIntentId) {
        res.status(400).json({ ok: false, error: "Missing payment intent id" });
        return;
      }

      const intent = await getStandalonePaymentIntent({
        filePath: params.config.standaloneAccountsFile,
        paymentIntentId,
      });
      if (!intent) {
        res.status(404).json({ ok: false, error: "Payment intent not found" });
        return;
      }

      res.json({
        ok: true,
        paymentIntent: {
          id: intent.id,
          toPlan: intent.toPlan,
          status: intent.status,
          amountUsd: intent.amountUsd,
          paidAt: intent.paidAt,
        },
      });
    },
  );

  router.post(
    "/public/billing/intents/:paymentIntentId/confirm",
    async (req: Request, res: Response) => {
      const paymentIntentId = req.params.paymentIntentId?.trim();
      if (!paymentIntentId) {
        res.status(400).json({ ok: false, error: "Missing payment intent id" });
        return;
      }

      if (!params.config.mercadoPagoAccessToken) {
        res.status(503).json({
          ok: false,
          error: "Mercado Pago access token is not configured",
        });
        return;
      }

      const intent = await getStandalonePaymentIntent({
        filePath: params.config.standaloneAccountsFile,
        paymentIntentId,
      });
      if (!intent) {
        res.status(404).json({ ok: false, error: "Payment intent not found" });
        return;
      }

      if (intent.status === "paid" || intent.status === "attached") {
        res.json({ ok: true, paymentIntent: intent });
        return;
      }

      try {
        const payment = await findMercadoPagoPaymentByExternalReference({
          accessToken: params.config.mercadoPagoAccessToken,
          externalReference: paymentIntentId,
        });
        if (!payment) {
          res.json({
            ok: true,
            paymentIntent: intent,
            paymentStatus: "not_found",
          });
          return;
        }

        if (payment.status !== "approved") {
          res.json({
            ok: true,
            paymentIntent: intent,
            paymentStatus: payment.status,
          });
          return;
        }

        const completedIntent = await completeStandalonePaymentIntent({
          filePath: params.config.standaloneAccountsFile,
          paymentIntentId,
          providerPaymentId: payment.id,
          paidAt: payment.dateApproved ?? new Date().toISOString(),
        });

        res.json({
          ok: true,
          paymentIntent: completedIntent,
          paymentStatus: payment.status,
        });
      } catch (error) {
        res.status(400).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not confirm payment",
        });
      }
    },
  );

  router.post("/public/login", async (req: Request, res: Response) => {
    const parsed = standaloneLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid login payload",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const session = await createStandaloneSession({
        filePath: params.config.standaloneAccountsFile,
        email: parsed.data.email,
        password: parsed.data.password,
      });
      const usage = await getStandaloneUsage({
        filePath: params.config.standaloneAccountsFile,
        accountId: session.account.id,
      });
      const billing = await getEffectiveBillingForAccount(
        params.config,
        session.account,
      );

      res.json({
        ok: true,
        account: publicStandaloneAccount(session.account, params.config),
        sessionToken: session.sessionToken,
        sessionExpiresAt: session.expiresAt,
        entitlements: billing.entitlements,
        effectivePlan: billing.effectivePlan,
        billingRestricted: billing.billingRestricted,
        usage,
      });
    } catch (error) {
      res.status(401).json({
        ok: false,
        error:
          error instanceof Error ? error.message : "Invalid email or password",
      });
    }
  });

  router.post(
    "/public/mercadopago/webhook",
    async (req: Request, res: Response) => {
      if (!params.config.mercadoPagoAccessToken) {
        res.status(503).json({
          ok: false,
          error: "Mercado Pago access token is not configured",
        });
        return;
      }

      const eventType = readWebhookType(req);
      const eventId = readWebhookPaymentId(req);
      if (isPreapprovalWebhook(eventType)) {
        if (!eventId) {
          res.status(400).json({ ok: false, error: "Missing preapproval id" });
          return;
        }

        try {
          const preapproval = await getMercadoPagoPreapproval({
            accessToken: params.config.mercadoPagoAccessToken,
            preapprovalId: eventId,
          });
          const localStatus = mapPreapprovalStatus(preapproval.status);
          if (!localStatus) {
            res.json({
              ok: true,
              ignored: true,
              reason: `Preapproval status is ${preapproval.status}`,
            });
            return;
          }

          if (localStatus === "active") {
            if (!preapproval.externalReference) {
              res.status(400).json({
                ok: false,
                error: "Preapproval is missing external reference",
              });
              return;
            }

            const activated = await activateStandalonePreapprovalSubscription({
              filePath: params.config.standaloneAccountsFile,
              billingRequestId: preapproval.externalReference,
              providerSubscriptionId: preapproval.id,
              nextPaymentDate: preapproval.nextPaymentDate,
            });
            res.json({
              ok: true,
              account: publicStandaloneAccount(
                activated.account,
                params.config,
              ),
              billingRequest: activated.billingRequest,
              subscription: activated.subscription,
            });
            return;
          }

          const subscription = await updateStandaloneSubscriptionFromProvider({
            filePath: params.config.standaloneAccountsFile,
            providerSubscriptionId: preapproval.id,
            status: localStatus,
            nextPaymentDate: preapproval.nextPaymentDate,
          });
          res.json({ ok: true, subscription });
          return;
        } catch (error) {
          res.status(400).json({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not process Mercado Pago subscription webhook",
          });
          return;
        }
      }

      const paymentId = eventId;
      if (!paymentId) {
        res.status(400).json({ ok: false, error: "Missing payment id" });
        return;
      }

      try {
        const payment = await getMercadoPagoPayment({
          accessToken: params.config.mercadoPagoAccessToken,
          paymentId,
        });

        if (payment.status !== "approved") {
          res.json({
            ok: true,
            ignored: true,
            reason: `Payment status is ${payment.status}`,
          });
          return;
        }

        if (!payment.externalReference) {
          res.status(400).json({
            ok: false,
            error: "Payment is missing external reference",
          });
          return;
        }

        if (payment.externalReference.startsWith("payint_")) {
          const intent = await completeStandalonePaymentIntent({
            filePath: params.config.standaloneAccountsFile,
            paymentIntentId: payment.externalReference,
            providerPaymentId: payment.id,
            paidAt: payment.dateApproved ?? new Date().toISOString(),
          });
          res.json({ ok: true, paymentIntent: intent });
          return;
        }

        const completed = await completeStandaloneBillingRequest({
          filePath: params.config.standaloneAccountsFile,
          billingRequestId: payment.externalReference,
          providerPaymentId: payment.id,
          amountUsd: payment.transactionAmount ?? 0,
          paidAt: payment.dateApproved ?? new Date().toISOString(),
        });

        res.json({
          ok: true,
          account: publicStandaloneAccount(completed.account, params.config),
          billingRequest: completed.billingRequest,
          subscription: completed.subscription,
          invoice: completed.invoice,
        });
      } catch (error) {
        res.status(400).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not process Mercado Pago webhook",
        });
      }
    },
  );

  router.get("/account/me", async (req: Request, res: Response) => {
    const account = await requireStandaloneAccount(req, res, params.config);
    if (!account) {
      return;
    }

    const usage = await getStandaloneUsage({
      filePath: params.config.standaloneAccountsFile,
      accountId: account.id,
    });
    const billing = await getEffectiveBillingForAccount(params.config, account);

    res.json({
      ok: true,
      account: publicStandaloneAccount(account, params.config),
      entitlements: billing.entitlements,
      effectivePlan: billing.effectivePlan,
      billingRestricted: billing.billingRestricted,
      usage,
    });
  });

  router.patch("/account/me", async (req: Request, res: Response) => {
    const account = await requireStandaloneAccount(req, res, params.config);
    if (!account) {
      return;
    }

    const parsed = standaloneAccountUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid account update",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const updatedAccount = await updateStandaloneAccountProjectName({
      filePath: params.config.standaloneAccountsFile,
      accountId: account.id,
      projectName: parsed.data.projectName,
    });

    const usage = await getStandaloneUsage({
      filePath: params.config.standaloneAccountsFile,
      accountId: updatedAccount.id,
    });
    const billing = await getEffectiveBillingForAccount(
      params.config,
      updatedAccount,
    );

    res.json({
      ok: true,
      account: publicStandaloneAccount(updatedAccount, params.config),
      entitlements: billing.entitlements,
      effectivePlan: billing.effectivePlan,
      billingRestricted: billing.billingRestricted,
      usage,
    });
  });

  router.patch("/account/password", async (req: Request, res: Response) => {
    const account = await requireStandaloneAccount(req, res, params.config);
    if (!account) {
      return;
    }

    const parsed = standalonePasswordUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid password update",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const updatedAccount = await updateStandaloneAccountPassword({
      filePath: params.config.standaloneAccountsFile,
      accountId: account.id,
      password: parsed.data.password,
    });

    res.json({
      ok: true,
      account: publicStandaloneAccount(updatedAccount, params.config),
    });
  });

  router.post("/account/api-key", async (req: Request, res: Response) => {
    const account = await requireStandaloneAccount(req, res, params.config);
    if (!account) {
      return;
    }

    const rotated = await rotateStandaloneAccountApiKey({
      filePath: params.config.standaloneAccountsFile,
      accountId: account.id,
    });

    res.status(201).json({
      ok: true,
      account: publicStandaloneAccount(rotated.account, params.config),
      apiKey: rotated.apiKey,
      apiKeyNotice:
        "Store this API key now. It is only returned once and replaces the previous key.",
    });
  });

  router.get("/account/usage", async (req: Request, res: Response) => {
    const account = await requireStandaloneAccount(req, res, params.config);
    if (!account) {
      return;
    }

    const usage = await getStandaloneUsage({
      filePath: params.config.standaloneAccountsFile,
      accountId: account.id,
    });

    res.json({ ok: true, usage });
  });

  router.get("/account/usage/monthly", async (req: Request, res: Response) => {
    const account = await requireStandaloneAccount(req, res, params.config);
    if (!account) {
      return;
    }

    const parsed = monthQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "month must use YYYY-MM format",
      });
      return;
    }

    const month = parsed.data.month ?? currentMonth();
    const range = getMonthRange(month);
    const storedUsageDays = await listStandaloneUsageDays({
      filePath: params.config.standaloneAccountsFile,
      accountId: account.id,
      from: range.from,
      to: range.to,
    });
    const usageDays = buildMonthlyUsageDays({
      month,
      usageDays: storedUsageDays,
    });
    const totalMessages = usageDays.reduce(
      (total, usage) => total + usage.messagesSent,
      0,
    );

    res.json({
      ok: true,
      month,
      from: range.from,
      to: range.to,
      usageDays,
      totalMessages,
    });
  });

  router.get("/account/billing", async (req: Request, res: Response) => {
    const account = await requireStandaloneAccount(req, res, params.config);
    if (!account) {
      return;
    }

    const billing = await getStandaloneBillingSummary({
      filePath: params.config.standaloneAccountsFile,
      accountId: account.id,
    });

    res.json({
      ok: true,
      account: publicStandaloneAccount(account, params.config),
      plans: listStandalonePlans(),
      currentPlan: billing.currentPlan,
      subscription: billing.subscription,
      invoices: billing.invoices,
      paymentMethods: billing.paymentMethods,
      billingRequests: billing.billingRequests,
    });
  });

  router.get("/account/admin/overview", async (req: Request, res: Response) => {
    const account = await requireStandaloneAccount(req, res, params.config);
    if (!account) {
      return;
    }

    if (!isStandaloneSuperowner(account, params.config)) {
      res.status(403).json({
        ok: false,
        error: "Superowner access required",
      });
      return;
    }

    const overview = await getStandaloneAdminOverview({
      filePath: params.config.standaloneAccountsFile,
    });
    const phoneHealth = {
      total: 0,
      connected: 0,
      qrPending: 0,
      errors: 0,
      inactive: 0,
      unknown: 0,
    };

    for (const accountSummary of overview.accounts) {
      for (const connectionId of accountSummary.connectionIds) {
        phoneHealth.total += 1;
        const snapshot = params.connectionManager.getSnapshot(connectionId);
        if (!snapshot) {
          phoneHealth.unknown += 1;
        } else if (snapshot.connected) {
          phoneHealth.connected += 1;
        } else if (snapshot.hasQr) {
          phoneHealth.qrPending += 1;
        } else if (snapshot.state === "ERROR") {
          phoneHealth.errors += 1;
        } else {
          phoneHealth.inactive += 1;
        }
      }
    }

    res.json({ ok: true, overview: { ...overview, phoneHealth } });
  });

  router.post(
    "/account/billing/payment-methods",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const parsed = paymentMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid payment method payload",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const paymentMethod = await createStandalonePaymentMethod({
        filePath: params.config.standaloneAccountsFile,
        accountId: account.id,
        ...parsed.data,
      });

      res.status(201).json({ ok: true, paymentMethod });
    },
  );

  router.post(
    "/account/billing/payment-methods/:paymentMethodId/default",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const paymentMethodId = req.params.paymentMethodId;
      if (!paymentMethodId) {
        res.status(400).json({ ok: false, error: "Missing payment method id" });
        return;
      }

      try {
        const paymentMethod = await setDefaultStandalonePaymentMethod({
          filePath: params.config.standaloneAccountsFile,
          accountId: account.id,
          paymentMethodId,
        });
        res.json({ ok: true, paymentMethod });
      } catch (error) {
        res.status(404).json({
          ok: false,
          error:
            error instanceof Error ? error.message : "Payment method not found",
        });
      }
    },
  );

  router.delete(
    "/account/billing/payment-methods/:paymentMethodId",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const paymentMethodId = req.params.paymentMethodId;
      if (!paymentMethodId) {
        res.status(400).json({ ok: false, error: "Missing payment method id" });
        return;
      }

      const deleted = await deleteStandalonePaymentMethod({
        filePath: params.config.standaloneAccountsFile,
        accountId: account.id,
        paymentMethodId,
      });
      res.json({ ok: true, deleted });
    },
  );

  router.post(
    "/account/billing/checkout",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const parsed = billingCheckoutSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid billing payload",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      try {
        const selectedPlan = listStandalonePlans().find(
          (plan) => plan.plan === parsed.data.plan,
        );
        if (!selectedPlan || selectedPlan.monthlyPriceUsd === null) {
          res.status(400).json({
            ok: false,
            error: "Choose a fixed-price paid plan",
          });
          return;
        }

        const billingRequest = await createStandaloneBillingRequest({
          filePath: params.config.standaloneAccountsFile,
          accountId: account.id,
          toPlan: parsed.data.plan as StandalonePlan,
          billingCycle: parsed.data.billingCycle,
        });

        res.status(201).json({
          ok: true,
          billingRequest,
          checkoutUrl: billingRequest.checkoutUrl,
        });
      } catch (error) {
        res.status(400).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not create billing request",
        });
      }
    },
  );

  router.post(
    "/account/billing/card-payment",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const parsed = billingCardPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid card payment payload",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const selectedPlan = listStandalonePlans().find(
        (plan) => plan.plan === parsed.data.plan,
      );
      if (!selectedPlan || selectedPlan.monthlyPriceUsd === null) {
        res.status(400).json({
          ok: false,
          error: "Choose a fixed-price paid plan",
        });
        return;
      }

      if (!params.config.mercadoPagoAccessToken) {
        res.status(503).json({
          ok: false,
          error: "Mercado Pago access token is not configured",
        });
        return;
      }

      try {
        const billing = await getStandaloneBillingSummary({
          filePath: params.config.standaloneAccountsFile,
          accountId: account.id,
        });
        const billingRequest = billing.billingRequests.find(
          (request) =>
            request.id === parsed.data.billingRequestId &&
            request.status === "pending",
        );
        if (!billingRequest) {
          res.status(404).json({
            ok: false,
            error: "Pending billing request not found",
          });
          return;
        }

        console.info("[wa billing] creating authenticated card payment", {
          billingRequestId: parsed.data.billingRequestId,
          accountId: account.id,
          plan: selectedPlan.plan,
          amount: selectedPlan.monthlyPriceUsd,
          paymentMethodId: parsed.data.payment_method_id,
          installments: parsed.data.installments,
          issuerId: parsed.data.issuer_id ?? null,
          payerEmail: parsed.data.payer.email,
          hasIdentification: Boolean(parsed.data.payer.identification),
        });
        const payment = await createMercadoPagoCardPayment({
          accessToken: params.config.mercadoPagoAccessToken,
          token: parsed.data.token,
          transactionAmount: selectedPlan.monthlyPriceUsd,
          installments: parsed.data.installments,
          paymentMethodId: parsed.data.payment_method_id,
          issuerId: parsed.data.issuer_id ?? null,
          payer: parsed.data.payer,
          description: `TAKU WA ${selectedPlan.name}`,
          externalReference: parsed.data.billingRequestId,
          idempotencyKey: randomUUID(),
        });

        console.info("[wa billing] authenticated card payment response", {
          billingRequestId: parsed.data.billingRequestId,
          providerPaymentId: payment.id,
          status: payment.status,
          statusDetail: payment.statusDetail,
          paymentMethodId: payment.paymentMethodId,
          amount: payment.transactionAmount,
          currency: payment.currencyId,
          dateApproved: payment.dateApproved,
        });

        if (payment.status !== "approved") {
          res.status(402).json({
            ok: false,
            error: `Payment is ${payment.status}`,
            paymentStatus: payment.status,
            paymentStatusDetail: payment.statusDetail,
          });
          return;
        }

        const completed = await completeStandaloneBillingRequest({
          filePath: params.config.standaloneAccountsFile,
          billingRequestId: parsed.data.billingRequestId,
          providerPaymentId: payment.id,
          amountUsd: payment.transactionAmount ?? selectedPlan.monthlyPriceUsd,
          paidAt: payment.dateApproved ?? new Date().toISOString(),
        });

        res.status(201).json({
          ok: true,
          account: publicStandaloneAccount(completed.account, params.config),
          billingRequest: completed.billingRequest,
          subscription: completed.subscription,
          invoice: completed.invoice,
          paymentStatus: payment.status,
        });
      } catch (error) {
        if (error instanceof MercadoPagoRequestError) {
          console.error("[wa billing] authenticated card payment failed", {
            status: error.status,
            error: error.error,
            message: error.message,
            causes: error.causes,
            plan: parsed.data.plan,
            paymentMethodId: parsed.data.payment_method_id,
            installments: parsed.data.installments,
            issuerId: parsed.data.issuer_id ?? null,
            payerEmail: parsed.data.payer.email,
            hasIdentification: Boolean(parsed.data.payer.identification),
          });
          res.status(400).json({
            ok: false,
            error: error.message,
            providerStatus: error.status,
            providerError: error.error,
            providerCauses: error.causes,
          });
          return;
        }

        console.error("[wa billing] authenticated card payment failed", {
          error: error instanceof Error ? error.message : String(error),
          billingRequestId: parsed.data.billingRequestId,
          plan: parsed.data.plan,
        });
        res.status(400).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not process card payment",
        });
      }
    },
  );

  router.get("/account/connections", async (req: Request, res: Response) => {
    const account = await requireStandaloneAccount(req, res, params.config);
    if (!account) {
      return;
    }

    const connections = [];
    for (const connectionId of account.connectionIds) {
      let connection = params.connectionManager.getSnapshot(connectionId);
      if (!connection) {
        connection = await params.connectionManager.createConnection({
          connectionId,
          businessId: account.id,
          label: account.projectName,
          autoStart: false,
        });
      }

      connections.push(connection);
    }

    res.json({ ok: true, total: connections.length, connections });
  });

  router.get(
    "/account/connections/:connectionId/messages",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (
        !connectionId ||
        !ensureAccountConnection(account, connectionId, res)
      ) {
        return;
      }

      const parsed = messageStreamQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid query",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const billing = await getEffectiveBillingForAccount(
        params.config,
        account,
      );
      const isFreePlan = billing.effectivePlan === "free";
      const limit = isFreePlan ? 20 : parsed.data.limit;
      const offset = isFreePlan ? 0 : parsed.data.offset;
      const result = await listMessages({
        filePath: getConnectionConversationStoreFile(
          params.config,
          connectionId,
        ),
        direction: "inbound",
        limit,
        offset,
      });

      res.json({
        ok: true,
        connectionId,
        messages: result.messages,
        total: result.total,
        limit,
        offset,
        hasMore: !isFreePlan && offset + result.messages.length < result.total,
        restricted: isFreePlan,
        entitlements: billing.entitlements,
      });
    },
  );

  router.post("/account/connections", async (req: Request, res: Response) => {
    const account = await requireStandaloneAccount(req, res, params.config);
    if (!account) {
      return;
    }

    const parsed = standaloneCreateConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid connection payload",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const billing = await getEffectiveBillingForAccount(params.config, account);
    const entitlements = billing.entitlements;
    if (
      entitlements.connectionLimit !== null &&
      account.connectionIds.length >= entitlements.connectionLimit
    ) {
      res.status(402).json({
        ok: false,
        error: "Upgrade required to add another WhatsApp phone",
        upgradeRequired: true,
        billingRestricted: billing.billingRestricted,
        entitlements,
      });
      return;
    }

    const connectionId = createStandaloneConnectionId();
    try {
      await params.connectionManager.createConnection({
        connectionId,
        businessId: account.id,
        label: parsed.data.label ?? account.projectName,
        autoStart: false,
      });
      const updatedAccount = await addStandaloneConnection({
        filePath: params.config.standaloneAccountsFile,
        accountId: account.id,
        connectionId,
      });
      const connection = await params.connectionManager.start(
        connectionId,
        "standalone_account_add_connection",
      );
      const qr = params.connectionManager.getLatestQr(connectionId);
      const qrImage = qr
        ? await QRCode.toDataURL(qr, {
            margin: 2,
            width: 320,
            errorCorrectionLevel: "M",
          })
        : null;

      res.status(201).json({
        ok: true,
        account: publicStandaloneAccount(updatedAccount, params.config),
        connection,
        connectionId,
        qr,
        qrImage,
        entitlements,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create WhatsApp connection",
      });
    }
  });

  router.get(
    "/account/connections/:connectionId/status",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (
        !connectionId ||
        !ensureAccountConnection(account, connectionId, res)
      ) {
        return;
      }

      const connection = params.connectionManager.getSnapshot(connectionId);
      if (!connection) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      res.json({ ok: true, connection });
    },
  );

  router.get(
    "/account/connections/:connectionId/qr",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (
        !connectionId ||
        !ensureAccountConnection(account, connectionId, res)
      ) {
        return;
      }

      let connection = params.connectionManager.getSnapshot(connectionId);
      if (!connection) {
        connection = await params.connectionManager.createConnection({
          connectionId,
          businessId: account.id,
          label: account.projectName,
          autoStart: false,
        });
      }

      if (!connection.connected && !connection.hasQr) {
        connection = await params.connectionManager.start(
          connectionId,
          "standalone_account_qr_request",
        );
      }

      let qr = params.connectionManager.getLatestQr(connectionId);
      for (let attempt = 0; !qr && attempt < 4; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        qr = params.connectionManager.getLatestQr(connectionId);
      }
      connection =
        params.connectionManager.getSnapshot(connectionId) ?? connection;
      const qrImage = qr
        ? await QRCode.toDataURL(qr, {
            margin: 2,
            width: 320,
            errorCorrectionLevel: "M",
          })
        : null;

      res.json({ ok: true, connection, qr, qrImage });
    },
  );

  router.post(
    "/account/connections/:connectionId/messages",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (
        !connectionId ||
        !ensureAccountConnection(account, connectionId, res)
      ) {
        return;
      }

      if (!params.connectionManager.get(connectionId)) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid request body",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      if (!(await ensurePaidBillingAccess(params.config, account, res))) {
        return;
      }

      const billing = await getEffectiveBillingForAccount(
        params.config,
        account,
      );
      const entitlements = billing.entitlements;
      const usageBeforeSend = await getStandaloneUsage({
        filePath: params.config.standaloneAccountsFile,
        accountId: account.id,
      });

      if (
        entitlements.dailyMessageLimit !== null &&
        usageBeforeSend.messagesSent >= entitlements.dailyMessageLimit
      ) {
        res.status(429).json({
          ok: false,
          error: "Daily message limit reached",
          usage: usageBeforeSend,
          entitlements,
        });
        return;
      }

      try {
        const phone = normalizePhone(parsed.data.to);
        const messageId = await params.connectionManager.sendTextMessage({
          connectionId,
          phone,
          text: parsed.data.text,
        });
        const usage = await incrementStandaloneMessages({
          filePath: params.config.standaloneAccountsFile,
          accountId: account.id,
        });

        res.json({
          ok: true,
          connectionId,
          to: phone,
          messageId,
          usage,
          entitlements,
        });
      } catch (error) {
        res.status(502).json({
          ok: false,
          error:
            error instanceof Error ? error.message : "Failed to send message",
        });
      }
    },
  );

  router.get(
    "/account/webhooks/subscriptions",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const subscriptions = await listWebhookSubscriptions(
        params.config.webhookSubscriptionsFile,
        { accountId: account.id },
      );

      res.json({ ok: true, total: subscriptions.length, subscriptions });
    },
  );

  router.post(
    "/account/webhooks/subscriptions",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const billing = await getEffectiveBillingForAccount(
        params.config,
        account,
      );
      const entitlements = billing.entitlements;
      if (!entitlements.webhooksEnabled) {
        res.status(403).json({
          ok: false,
          error: "Webhooks are not enabled for this plan",
          entitlements,
        });
        return;
      }

      const parsed = webhookSubscriptionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid request body",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const subscription = await createWebhookSubscription({
        filePath: params.config.webhookSubscriptionsFile,
        url: parsed.data.url,
        events: parsed.data.events as WebhookEventName[],
        secret: parsed.data.secret ?? null,
        accountId: account.id,
        connectionIds: account.connectionIds,
      });

      res.status(201).json({ ok: true, subscription });
    },
  );

  router.delete(
    "/account/webhooks/subscriptions/:id",
    async (req: Request, res: Response) => {
      const account = await requireStandaloneAccount(req, res, params.config);
      if (!account) {
        return;
      }

      const id = req.params.id;
      if (!id) {
        res.status(400).json({ ok: false, error: "Missing subscription id" });
        return;
      }

      const deleted = await deleteWebhookSubscriptionForAccount({
        filePath: params.config.webhookSubscriptionsFile,
        id,
        accountId: account.id,
      });
      res.json({ ok: true, deleted });
    },
  );

  router.get("/connections", (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const connections = params.connectionManager.list();
    res.json({ ok: true, total: connections.length, connections });
  });

  router.post("/connections", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const parsed = createConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid connection payload",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    if (parsed.data.connectionId === "default") {
      const connection = params.connectionManager.getSnapshot("default");
      if (!connection) {
        res.status(500).json({
          ok: false,
          error: "Default WhatsApp connection is not registered.",
        });
        return;
      }

      res.status(200).json({ ok: true, connection });
      return;
    }

    try {
      const connection = await params.connectionManager.createConnection({
        connectionId: parsed.data.connectionId,
        businessId: parsed.data.businessId ?? null,
        label: parsed.data.label ?? null,
        autoStart: parsed.data.autoStart,
      });
      res.status(201).json({ ok: true, connection });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create WhatsApp connection",
      });
    }
  });

  router.get(
    "/connections/:connectionId/status",
    (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      const connection = params.connectionManager.getSnapshot(connectionId);
      if (!connection) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      res.json({ ok: true, connection });
    },
  );

  router.post(
    "/connections/:connectionId/start",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      if (!params.connectionManager.get(connectionId)) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      try {
        const connection = await params.connectionManager.start(
          connectionId,
          "connection_api_start",
        );
        res.json({ ok: true, connection });
      } catch (error) {
        res.status(500).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to start WhatsApp connection",
        });
      }
    },
  );

  router.post(
    "/connections/:connectionId/stop",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      if (!params.connectionManager.get(connectionId)) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      try {
        const connection = await params.connectionManager.stop(
          connectionId,
          "connection_api_stop",
        );
        res.json({ ok: true, connection });
      } catch (error) {
        res.status(500).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to stop WhatsApp connection",
        });
      }
    },
  );

  router.post(
    "/connections/:connectionId/reset-session",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      if (!params.connectionManager.get(connectionId)) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      try {
        const connection = await params.connectionManager.resetSession(
          connectionId,
          "connection_api_reset_session",
        );
        res.json({ ok: true, connection });
      } catch (error) {
        res.status(500).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to reset WhatsApp connection session",
        });
      }
    },
  );

  router.get(
    "/connections/:connectionId/qr",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      const connection = params.connectionManager.getSnapshot(connectionId);
      if (!connection) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      const qr = params.connectionManager.getLatestQr(connectionId);
      const qrImage = qr
        ? await QRCode.toDataURL(qr, {
            margin: 2,
            width: 320,
            errorCorrectionLevel: "M",
          })
        : null;

      res.json({ ok: true, connection, qr, qrImage });
    },
  );

  router.post(
    "/connections/:connectionId/messages",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      if (!params.connectionManager.get(connectionId)) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid request body",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      try {
        const phone = normalizePhone(parsed.data.to);
        const messageId = await params.connectionManager.sendTextMessage({
          connectionId,
          phone,
          text: parsed.data.text,
        });

        res.json({
          ok: true,
          connectionId,
          to: phone,
          messageId,
        });
      } catch (error) {
        res.status(502).json({
          ok: false,
          error:
            error instanceof Error ? error.message : "Failed to send message",
        });
      }
    },
  );

  router.get("/whatsapp/status", (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    res.json({ ok: true, ...params.whatsAppClient.getStatus() });
  });

  router.get("/service/status", (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    res.json({ ok: true, ...params.whatsAppClient.getStatus() });
  });

  router.post("/service/activate", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    try {
      await params.whatsAppClient.start("manual_activate");
      res.json({ ok: true, ...params.whatsAppClient.getStatus() });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to activate WhatsApp service",
      });
    }
  });

  router.post("/service/deactivate", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    try {
      await params.whatsAppClient.stop("manual_deactivate");
      res.json({ ok: true, ...params.whatsAppClient.getStatus() });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to deactivate WhatsApp service",
      });
    }
  });

  router.post("/service/reset-session", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    try {
      await params.whatsAppClient.resetSession("manual_reset_session");
      res.json({ ok: true, ...params.whatsAppClient.getStatus() });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reset WhatsApp session",
      });
    }
  });

  router.get("/whatsapp/qr", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const qr = params.whatsAppClient.getLatestQr();
    const qrImage = qr
      ? await QRCode.toDataURL(qr, {
          margin: 2,
          width: 320,
          errorCorrectionLevel: "M",
        })
      : null;

    res.json({
      ok: true,
      qr,
      qrImage,
      ...params.whatsAppClient.getStatus(),
    });
  });

  router.post("/messages/send", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid request body",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const phone = normalizePhone(parsed.data.to);
      const messageId = await params.whatsAppClient.sendTextMessage({
        phone,
        text: parsed.data.text,
      });

      res.json({ ok: true, to: phone, messageId });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to send message",
      });
    }
  });

  router.get("/conversations", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const parsed = limitQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid query",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const conversations = await listConversations(
      params.config.conversationStoreFile,
      parsed.data.limit,
    );
    res.json({ ok: true, total: conversations.length, conversations });
  });

  router.get(
    "/conversations/:phone/messages",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const phone = parsePhoneParam(req, res);
      if (!phone) {
        return;
      }

      const parsed = limitQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid query",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const messages = await listConversationMessages({
        filePath: params.config.conversationStoreFile,
        phone,
        limit: parsed.data.limit,
      });

      res.json({ ok: true, phone, total: messages.length, messages });
    },
  );

  router.post(
    "/conversations/:phone/messages",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const phone = parsePhoneParam(req, res);
      if (!phone) {
        return;
      }

      const parsed = sendMessageSchema.omit({ to: true }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid request body",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      try {
        const messageId = await params.whatsAppClient.sendTextMessage({
          phone,
          text: parsed.data.text,
        });

        res.json({ ok: true, phone, messageId });
      } catch (error) {
        res.status(502).json({
          ok: false,
          error:
            error instanceof Error ? error.message : "Failed to send message",
        });
      }
    },
  );

  router.get(
    "/conversations/:phone/last-message",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const phone = parsePhoneParam(req, res);
      if (!phone) {
        return;
      }

      const message = await getLastConversationMessage({
        filePath: params.config.conversationStoreFile,
        phone,
      });

      res.json({ ok: true, phone, message });
    },
  );

  router.get("/webhooks/subscriptions", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const subscriptions = await listWebhookSubscriptions(
      params.config.webhookSubscriptionsFile,
    );
    res.json({ ok: true, total: subscriptions.length, subscriptions });
  });

  router.post(
    "/webhooks/subscriptions",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const parsed = webhookSubscriptionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid request body",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const subscription = await createWebhookSubscription({
        filePath: params.config.webhookSubscriptionsFile,
        url: parsed.data.url,
        events: parsed.data.events as WebhookEventName[],
        secret: parsed.data.secret ?? null,
      });

      res.status(201).json({ ok: true, subscription });
    },
  );

  router.delete(
    "/webhooks/subscriptions/:id",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const id = req.params.id;
      if (!id) {
        res.status(400).json({ ok: false, error: "Missing subscription id" });
        return;
      }

      const deleted = await deleteWebhookSubscription(
        params.config.webhookSubscriptionsFile,
        id,
      );
      res.json({ ok: true, deleted });
    },
  );

  return router;
}
