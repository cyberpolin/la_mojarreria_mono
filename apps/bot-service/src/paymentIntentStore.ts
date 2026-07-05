import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "./jsonStore.js";

export type BotPaymentPlan = "on_demand" | "high_usage";
export type BotPaymentIntentStatus = "pending" | "paid" | "attached";

export type BotPaymentIntent = {
  id: string;
  toPlan: BotPaymentPlan;
  status: BotPaymentIntentStatus;
  amountUsd: number;
  checkoutUrl: string;
  provider: "mercadopago";
  providerPreferenceId: string | null;
  providerPaymentId: string | null;
  paidAt: string | null;
  attachedAccountId: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaymentIntentStore = {
  paymentIntents: BotPaymentIntent[];
};

export type BotPaymentPlanDetails = { amountUsd: number; name: string };

function nowIso() {
  return new Date().toISOString();
}

function readStore(filePath: string): Promise<PaymentIntentStore> {
  return readJson<PaymentIntentStore>(filePath, { paymentIntents: [] }).then(
    (store) => ({
      paymentIntents: Array.isArray(store.paymentIntents)
        ? store.paymentIntents
        : [],
    }),
  );
}

export function isBotPaymentPlan(value: unknown): value is BotPaymentPlan {
  return value === "on_demand" || value === "high_usage";
}

export async function createBotPaymentIntent(params: {
  filePath: string;
  toPlan: BotPaymentPlan;
  planDetails: BotPaymentPlanDetails;
  attachedAccountId?: string | null;
}): Promise<BotPaymentIntent> {
  const store = await readStore(params.filePath);
  const now = nowIso();
  const plan = params.planDetails;
  const intent: BotPaymentIntent = {
    id: `bot_payint_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    toPlan: params.toPlan,
    status: "pending",
    amountUsd: plan.amountUsd,
    checkoutUrl: "",
    provider: "mercadopago",
    providerPreferenceId: null,
    providerPaymentId: null,
    paidAt: null,
    attachedAccountId: params.attachedAccountId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  store.paymentIntents.push(intent);
  await writeJson(params.filePath, store);
  return intent;
}

export async function completeBotPaymentIntent(params: {
  filePath: string;
  paymentIntentId: string;
  providerPaymentId: string;
  paidAt: string;
}): Promise<BotPaymentIntent> {
  const store = await readStore(params.filePath);
  const intent = store.paymentIntents.find(
    (item) => item.id === params.paymentIntentId,
  );
  if (!intent) {
    throw new Error("Payment intent not found");
  }

  if (intent.status === "pending") {
    intent.status = "paid";
    intent.providerPaymentId = params.providerPaymentId;
    intent.paidAt = params.paidAt;
    intent.updatedAt = nowIso();
    await writeJson(params.filePath, store);
  }

  return intent;
}

export async function getBotPaymentIntent(params: {
  filePath: string;
  paymentIntentId: string;
}): Promise<BotPaymentIntent | null> {
  const store = await readStore(params.filePath);
  return (
    store.paymentIntents.find((item) => item.id === params.paymentIntentId) ??
    null
  );
}

export async function listBotPaymentIntents(params: {
  filePath: string;
}): Promise<BotPaymentIntent[]> {
  const store = await readStore(params.filePath);
  return store.paymentIntents
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
