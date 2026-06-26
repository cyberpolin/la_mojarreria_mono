import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type StandalonePlan =
  | "free"
  | "basic"
  | "developer"
  | "platform"
  | "enterprise";

export type StandaloneAccount = {
  id: string;
  name: string;
  email: string;
  projectName: string;
  plan: StandalonePlan;
  passwordSalt: string;
  passwordHash: string;
  passwordSetupRequired?: boolean;
  apiKeyHash: string;
  connectionIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type StandaloneBillingCycle = "monthly";

export type StandalonePlanCatalogItem = {
  plan: StandalonePlan;
  name: string;
  monthlyPriceUsd: number | null;
  description: string;
  features: string[];
  entitlements: StandaloneEntitlements;
};

export type StandaloneBillingRequestStatus =
  | "pending"
  | "completed"
  | "cancelled";

export type StandaloneBillingRequest = {
  id: string;
  accountId: string;
  fromPlan: StandalonePlan;
  toPlan: StandalonePlan;
  billingCycle: StandaloneBillingCycle;
  status: StandaloneBillingRequestStatus;
  checkoutUrl: string;
  provider: "manual" | "mercadopago" | "mercadopago_preapproval";
  providerPreferenceId: string | null;
  providerSubscriptionId?: string | null;
  providerCheckoutUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StandaloneSubscriptionStatus =
  | "free"
  | "active"
  | "past_due"
  | "cancelled";

export type StandaloneSubscription = {
  accountId: string;
  plan: StandalonePlan;
  status: StandaloneSubscriptionStatus;
  billingCycle: StandaloneBillingCycle;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEnd?: string | null;
  provider?: "manual" | "mercadopago" | null;
  providerSubscriptionId?: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
};

export type StandaloneInvoiceStatus = "paid" | "open" | "void";

export type StandaloneInvoice = {
  id: string;
  accountId: string;
  plan: StandalonePlan;
  amountUsd: number;
  currency: "USD";
  status: StandaloneInvoiceStatus;
  description: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt: string | null;
  provider: "manual" | "mercadopago";
  providerPaymentId: string | null;
  createdAt: string;
};

export type StandalonePaymentMethod = {
  id: string;
  accountId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StandalonePaymentIntentStatus =
  | "pending"
  | "paid"
  | "attached"
  | "cancelled";

export type StandalonePaymentIntent = {
  id: string;
  toPlan: StandalonePlan;
  billingCycle: StandaloneBillingCycle;
  status: StandalonePaymentIntentStatus;
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

export type StandaloneEffectiveBilling = {
  accountPlan: StandalonePlan;
  effectivePlan: StandalonePlan;
  entitlements: StandaloneEntitlements;
  subscription: StandaloneSubscription;
  billingRestricted: boolean;
};

export type StandaloneAdminAccountSummary = {
  id: string;
  name: string;
  email: string;
  projectName: string;
  plan: StandalonePlan;
  connectionCount: number;
  connectionIds: string[];
  messagesToday: number;
  messagesThisMonth: number;
  subscriptionStatus: StandaloneSubscriptionStatus;
  currentPeriodEnd: string | null;
  openInvoiceCount: number;
  passwordSetupRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StandaloneAdminBillingOverview = {
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  cancelledSubscriptions: number;
  openInvoices: number;
  paidInvoices: number;
  revenueThisMonthUsd: number;
  nextDue: Array<{
    accountId: string;
    projectName: string;
    plan: StandalonePlan;
    currentPeriodEnd: string;
  }>;
};

export type StandaloneAdminUsageOverview = {
  messagesToday: number;
  messagesThisMonth: number;
  topAccounts: Array<{
    accountId: string;
    projectName: string;
    messagesThisMonth: number;
  }>;
};

export type StandaloneAdminSupportOverview = {
  passwordSetupRequired: number;
  accountsWithoutPhones: number;
  pendingBillingRequests: number;
  pendingPaymentIntents: number;
};

export type StandaloneAdminOverview = {
  totalAccounts: number;
  totalConnections: number;
  planCounts: Record<StandalonePlan, number>;
  billing: StandaloneAdminBillingOverview;
  usage: StandaloneAdminUsageOverview;
  support: StandaloneAdminSupportOverview;
  accounts: StandaloneAdminAccountSummary[];
};

export type StandaloneUsageDay = {
  accountId: string;
  date: string;
  messagesSent: number;
  updatedAt: string;
};

export type StandaloneSession = {
  accountId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
};

type StandaloneAccountData = {
  accounts: StandaloneAccount[];
  usageDays: StandaloneUsageDay[];
  sessions: StandaloneSession[];
  billingRequests: StandaloneBillingRequest[];
  subscriptions: StandaloneSubscription[];
  invoices: StandaloneInvoice[];
  paymentMethods: StandalonePaymentMethod[];
  paymentIntents: StandalonePaymentIntent[];
};

export type StandaloneEntitlements = {
  connectionLimit: number | null;
  dailyMessageLimit: number | null;
  webhooksEnabled: boolean;
};

let writeQueue = Promise.resolve();

function emptyData(): StandaloneAccountData {
  return {
    accounts: [],
    usageDays: [],
    sessions: [],
    billingRequests: [],
    subscriptions: [],
    invoices: [],
    paymentMethods: [],
    paymentIntents: [],
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function addMonths(dateIso: string, months: number): string {
  const date = new Date(dateIso);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function createStandaloneConnectionId(): string {
  return createId("wa");
}

async function readData(filePath: string): Promise<StandaloneAccountData> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as Partial<StandaloneAccountData>;
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      usageDays: Array.isArray(parsed.usageDays) ? parsed.usageDays : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      billingRequests: Array.isArray(parsed.billingRequests)
        ? parsed.billingRequests
        : [],
      subscriptions: Array.isArray(parsed.subscriptions)
        ? parsed.subscriptions
        : [],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      paymentMethods: Array.isArray(parsed.paymentMethods)
        ? parsed.paymentMethods
        : [],
      paymentIntents: Array.isArray(parsed.paymentIntents)
        ? parsed.paymentIntents
        : [],
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyData();
    }

    throw error;
  }
}

async function writeData(
  filePath: string,
  data: StandaloneAccountData,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function getStandaloneEntitlements(
  plan: StandalonePlan,
): StandaloneEntitlements {
  if (plan === "free") {
    return {
      connectionLimit: 1,
      dailyMessageLimit: 100,
      webhooksEnabled: true,
    };
  }

  if (plan === "basic") {
    return {
      connectionLimit: 1,
      dailyMessageLimit: null,
      webhooksEnabled: true,
    };
  }

  if (plan === "developer") {
    return {
      connectionLimit: 10,
      dailyMessageLimit: null,
      webhooksEnabled: true,
    };
  }

  if (plan === "platform") {
    return {
      connectionLimit: 50,
      dailyMessageLimit: null,
      webhooksEnabled: true,
    };
  }

  return {
    connectionLimit: null,
    dailyMessageLimit: null,
    webhooksEnabled: true,
  };
}

export function listStandalonePlans(): StandalonePlanCatalogItem[] {
  return [
    {
      plan: "free",
      name: "Starter",
      monthlyPriceUsd: 0,
      description: "Try the bridge with one WhatsApp connection.",
      features: ["1 connection", "100 messages/day", "Webhooks"],
      entitlements: getStandaloneEntitlements("free"),
    },
    {
      plan: "basic",
      name: "Basic",
      monthlyPriceUsd: 9,
      description: "For testing and prototypes.",
      features: [
        "1 connection",
        "Send messages",
        "Receive messages",
        "Webhooks",
        "Community support",
      ],
      entitlements: getStandaloneEntitlements("basic"),
    },
    {
      plan: "developer",
      name: "Developer",
      monthlyPriceUsd: 29,
      description: "Build WhatsApp into your own application.",
      features: [
        "Up to 10 connections",
        "Connection lifecycle API",
        "Webhooks",
        "Conversation history",
        "Auto reconnect",
        "Email support",
      ],
      entitlements: getStandaloneEntitlements("developer"),
    },
    {
      plan: "platform",
      name: "Platform",
      monthlyPriceUsd: 99,
      description: "For SaaS teams that need tenant-aware WhatsApp transport.",
      features: [
        "Up to 50 connections",
        "Multi-tenant management",
        "Priority webhooks",
        "Operational support",
        "TAKU Control integration",
      ],
      entitlements: getStandaloneEntitlements("platform"),
    },
    {
      plan: "enterprise",
      name: "Enterprise",
      monthlyPriceUsd: null,
      description: "Dedicated WhatsApp infrastructure for larger platforms.",
      features: [
        "Unlimited connections",
        "Dedicated infrastructure",
        "SLA",
        "White-label options",
      ],
      entitlements: getStandaloneEntitlements("enterprise"),
    },
  ];
}

export async function createStandaloneFreeAccount(params: {
  filePath: string;
  name: string;
  email: string;
  projectName: string;
  password: string;
  paidPaymentIntentId?: string | null;
}): Promise<{
  account: StandaloneAccount;
  apiKey: string;
  connectionId: string;
}> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const email = params.email.toLowerCase();
    const existing = data.accounts.find((account) => account.email === email);
    if (existing) {
      throw new Error("Email already has a TAKU WA account");
    }

    const paymentIntent = params.paidPaymentIntentId
      ? data.paymentIntents.find(
          (intent) =>
            intent.id === params.paidPaymentIntentId &&
            intent.status === "paid" &&
            intent.attachedAccountId === null,
        )
      : null;
    if (params.paidPaymentIntentId && !paymentIntent) {
      throw new Error("Paid plan confirmation is missing or already used");
    }

    const now = nowIso();
    const apiKey = `taku_wa_${randomBytes(24).toString("base64url")}`;
    const connectionId = createStandaloneConnectionId();
    const passwordSalt = randomBytes(16).toString("hex");
    const account: StandaloneAccount = {
      id: createId("acct"),
      name: params.name,
      email,
      projectName: params.projectName,
      plan: paymentIntent?.toPlan ?? "free",
      passwordSalt,
      passwordHash: hashPassword(params.password, passwordSalt),
      apiKeyHash: hash(apiKey),
      passwordSetupRequired: Boolean(paymentIntent),
      connectionIds: [connectionId],
      createdAt: now,
      updatedAt: now,
    };

    data.accounts.push(account);

    if (paymentIntent) {
      paymentIntent.status = "attached";
      paymentIntent.attachedAccountId = account.id;
      paymentIntent.updatedAt = now;

      const periodStart = paymentIntent.paidAt ?? now;
      const periodEnd = addMonths(periodStart, 1);
      data.subscriptions.push({
        accountId: account.id,
        plan: paymentIntent.toPlan,
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gracePeriodEnd: null,
        provider: "mercadopago",
        providerSubscriptionId: null,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      });

      const plan =
        listStandalonePlans().find(
          (item) => item.plan === paymentIntent.toPlan,
        ) ?? listStandalonePlans()[0];
      data.invoices.push({
        id: createId("inv"),
        accountId: account.id,
        plan: paymentIntent.toPlan,
        amountUsd: paymentIntent.amountUsd,
        currency: "USD",
        status: "paid",
        description: `TAKU WA ${plan?.name ?? paymentIntent.toPlan}`,
        periodStart,
        periodEnd,
        dueDate: periodStart,
        paidAt: paymentIntent.paidAt ?? now,
        provider: "mercadopago",
        providerPaymentId: paymentIntent.providerPaymentId,
        createdAt: now,
      });
    }

    await writeData(params.filePath, data);
    return { account, apiKey, connectionId };
  });
}

export async function ensureStandaloneSuperownerAccount(params: {
  filePath: string;
  email: string;
  password: string;
}): Promise<StandaloneAccount> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const email = params.email.toLowerCase();
    const existing = data.accounts.find((account) => account.email === email);
    const now = nowIso();
    const passwordSalt = randomBytes(16).toString("hex");

    if (existing) {
      existing.name = existing.name || "TAKU Superowner";
      existing.projectName = existing.projectName || "TAKU Platform";
      existing.plan = "platform";
      existing.passwordSalt = passwordSalt;
      existing.passwordHash = hashPassword(params.password, passwordSalt);
      existing.passwordSetupRequired = false;
      existing.updatedAt = now;
      await writeData(params.filePath, data);
      return existing;
    }

    const account: StandaloneAccount = {
      id: createId("acct"),
      name: "TAKU Superowner",
      email,
      projectName: "TAKU Platform",
      plan: "platform",
      passwordSalt,
      passwordHash: hashPassword(params.password, passwordSalt),
      apiKeyHash: hash(`seed:${email}:${now}`),
      passwordSetupRequired: false,
      connectionIds: [],
      createdAt: now,
      updatedAt: now,
    };

    data.accounts.push(account);
    await writeData(params.filePath, data);
    return account;
  });
}

export async function findStandaloneAccountByApiKey(params: {
  filePath: string;
  apiKey: string;
}): Promise<StandaloneAccount | null> {
  const data = await readData(params.filePath);
  const apiKeyHash = hash(params.apiKey);
  return (
    data.accounts.find((account) => account.apiKeyHash === apiKeyHash) ?? null
  );
}

export async function rotateStandaloneAccountApiKey(params: {
  filePath: string;
  accountId: string;
}): Promise<{ account: StandaloneAccount; apiKey: string }> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const account = data.accounts.find((item) => item.id === params.accountId);
    if (!account) {
      throw new Error("Standalone account not found");
    }

    const apiKey = `taku_wa_${randomBytes(24).toString("base64url")}`;
    account.apiKeyHash = hash(apiKey);
    account.updatedAt = nowIso();

    await writeData(params.filePath, data);
    return { account, apiKey };
  });
}

export async function updateStandaloneAccountProjectName(params: {
  filePath: string;
  accountId: string;
  projectName: string;
}): Promise<StandaloneAccount> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const account = data.accounts.find((item) => item.id === params.accountId);
    if (!account) {
      throw new Error("Standalone account not found");
    }

    account.projectName = params.projectName;
    account.updatedAt = nowIso();

    await writeData(params.filePath, data);
    return account;
  });
}

export async function updateStandaloneAccountPassword(params: {
  filePath: string;
  accountId: string;
  password: string;
}): Promise<StandaloneAccount> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const account = data.accounts.find((item) => item.id === params.accountId);
    if (!account) {
      throw new Error("Standalone account not found");
    }

    const passwordSalt = randomBytes(16).toString("hex");
    account.passwordSalt = passwordSalt;
    account.passwordHash = hashPassword(params.password, passwordSalt);
    account.passwordSetupRequired = false;
    account.updatedAt = nowIso();

    await writeData(params.filePath, data);
    return account;
  });
}

function createSessionToken(): string {
  return `taku_wa_session_${randomBytes(32).toString("base64url")}`;
}

function createSessionExpiry(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export async function createStandaloneSession(params: {
  filePath: string;
  email: string;
  password: string;
}): Promise<{
  account: StandaloneAccount;
  sessionToken: string;
  expiresAt: string;
}> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const email = params.email.toLowerCase();
    const account = data.accounts.find((item) => item.email === email);
    if (!account) {
      throw new Error("Invalid email or password");
    }

    const passwordHash = hashPassword(params.password, account.passwordSalt);
    if (passwordHash !== account.passwordHash) {
      throw new Error("Invalid email or password");
    }

    const now = nowIso();
    data.sessions = data.sessions.filter(
      (session) => session.accountId !== account.id || session.expiresAt > now,
    );

    const sessionToken = createSessionToken();
    const expiresAt = createSessionExpiry();
    data.sessions.push({
      accountId: account.id,
      tokenHash: hash(sessionToken),
      createdAt: now,
      expiresAt,
    });

    await writeData(params.filePath, data);
    return { account, sessionToken, expiresAt };
  });
}

export async function createStandaloneSessionForAccount(params: {
  filePath: string;
  accountId: string;
}): Promise<{
  sessionToken: string;
  expiresAt: string;
}> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const account = data.accounts.find((item) => item.id === params.accountId);
    if (!account) {
      throw new Error("Standalone account not found");
    }

    const sessionToken = createSessionToken();
    const expiresAt = createSessionExpiry();
    data.sessions.push({
      accountId: account.id,
      tokenHash: hash(sessionToken),
      createdAt: nowIso(),
      expiresAt,
    });

    await writeData(params.filePath, data);
    return { sessionToken, expiresAt };
  });
}

export async function findStandaloneAccountBySessionToken(params: {
  filePath: string;
  sessionToken: string;
}): Promise<StandaloneAccount | null> {
  const data = await readData(params.filePath);
  const now = nowIso();
  const tokenHash = hash(params.sessionToken);
  const session = data.sessions.find(
    (item) => item.tokenHash === tokenHash && item.expiresAt > now,
  );
  if (!session) {
    return null;
  }

  return (
    data.accounts.find((account) => account.id === session.accountId) ?? null
  );
}

export async function getStandaloneUsage(params: {
  filePath: string;
  accountId: string;
  date?: string;
}): Promise<StandaloneUsageDay> {
  const data = await readData(params.filePath);
  const usageDate = params.date ?? today();
  return (
    data.usageDays.find(
      (usage) =>
        usage.accountId === params.accountId && usage.date === usageDate,
    ) ?? {
      accountId: params.accountId,
      date: usageDate,
      messagesSent: 0,
      updatedAt: nowIso(),
    }
  );
}

export async function listStandaloneUsageDays(params: {
  filePath: string;
  accountId: string;
  from: string;
  to: string;
}): Promise<StandaloneUsageDay[]> {
  const data = await readData(params.filePath);
  return data.usageDays
    .filter(
      (usage) =>
        usage.accountId === params.accountId &&
        usage.date >= params.from &&
        usage.date <= params.to,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function incrementStandaloneMessages(params: {
  filePath: string;
  accountId: string;
  count?: number;
}): Promise<StandaloneUsageDay> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const usageDate = today();
    let usage = data.usageDays.find(
      (item) => item.accountId === params.accountId && item.date === usageDate,
    );
    if (!usage) {
      usage = {
        accountId: params.accountId,
        date: usageDate,
        messagesSent: 0,
        updatedAt: nowIso(),
      };
      data.usageDays.push(usage);
    }

    usage.messagesSent += params.count ?? 1;
    usage.updatedAt = nowIso();
    await writeData(params.filePath, data);
    return usage;
  });
}

export async function getStandaloneBillingSummary(params: {
  filePath: string;
  accountId: string;
}): Promise<{
  currentPlan: StandalonePlanCatalogItem;
  subscription: StandaloneSubscription;
  billingRequests: StandaloneBillingRequest[];
  invoices: StandaloneInvoice[];
  paymentMethods: StandalonePaymentMethod[];
}> {
  const data = await readData(params.filePath);
  const account = data.accounts.find((item) => item.id === params.accountId);
  if (!account) {
    throw new Error("Standalone account not found");
  }

  const currentPlan = listStandalonePlans().find(
    (plan) => plan.plan === account.plan,
  );
  if (!currentPlan) {
    throw new Error("Standalone account has an invalid plan");
  }

  const subscription = data.subscriptions.find(
    (item) => item.accountId === params.accountId,
  ) ?? {
    accountId: params.accountId,
    plan: account.plan,
    status: account.plan === "free" ? "free" : "active",
    billingCycle: "monthly",
    currentPeriodStart: account.plan === "free" ? null : account.updatedAt,
    currentPeriodEnd:
      account.plan === "free" ? null : addMonths(account.updatedAt, 1),
    gracePeriodEnd: null,
    provider: null,
    providerSubscriptionId: null,
    cancelAtPeriodEnd: false,
    updatedAt: account.updatedAt,
  };

  return {
    currentPlan,
    subscription,
    billingRequests: data.billingRequests
      .filter((request) => request.accountId === params.accountId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    invoices: data.invoices
      .filter((invoice) => invoice.accountId === params.accountId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    paymentMethods: data.paymentMethods
      .filter((method) => method.accountId === params.accountId)
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault)),
  };
}

export async function createStandalonePaymentIntent(params: {
  filePath: string;
  toPlan: StandalonePlan;
  amountUsd: number;
  billingCycle?: StandaloneBillingCycle;
}): Promise<StandalonePaymentIntent> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const plan = listStandalonePlans().find(
      (item) => item.plan === params.toPlan,
    );
    if (!plan || plan.plan === "free" || plan.monthlyPriceUsd === null) {
      throw new Error("Choose a fixed-price paid plan");
    }

    const now = nowIso();
    const intent: StandalonePaymentIntent = {
      id: createId("payint"),
      toPlan: params.toPlan,
      billingCycle: params.billingCycle ?? "monthly",
      status: "pending",
      amountUsd: params.amountUsd,
      checkoutUrl: "",
      provider: "mercadopago",
      providerPreferenceId: null,
      providerPaymentId: null,
      paidAt: null,
      attachedAccountId: null,
      createdAt: now,
      updatedAt: now,
    };

    data.paymentIntents.push(intent);
    await writeData(params.filePath, data);
    return intent;
  });
}

export async function updateStandalonePaymentIntentCheckout(params: {
  filePath: string;
  paymentIntentId: string;
  providerPreferenceId: string;
  checkoutUrl: string;
}): Promise<StandalonePaymentIntent> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const intent = data.paymentIntents.find(
      (item) => item.id === params.paymentIntentId,
    );
    if (!intent) {
      throw new Error("Payment intent not found");
    }

    intent.providerPreferenceId = params.providerPreferenceId;
    intent.checkoutUrl = params.checkoutUrl;
    intent.updatedAt = nowIso();

    await writeData(params.filePath, data);
    return intent;
  });
}

export async function completeStandalonePaymentIntent(params: {
  filePath: string;
  paymentIntentId: string;
  providerPaymentId: string;
  paidAt: string;
}): Promise<StandalonePaymentIntent> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const intent = data.paymentIntents.find(
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
      await writeData(params.filePath, data);
    }

    return intent;
  });
}

export async function getStandalonePaymentIntent(params: {
  filePath: string;
  paymentIntentId: string;
}): Promise<StandalonePaymentIntent | null> {
  const data = await readData(params.filePath);
  return (
    data.paymentIntents.find((item) => item.id === params.paymentIntentId) ??
    null
  );
}

export async function createStandaloneBillingRequest(params: {
  filePath: string;
  accountId: string;
  toPlan: StandalonePlan;
  billingCycle?: StandaloneBillingCycle;
}): Promise<StandaloneBillingRequest> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const account = data.accounts.find((item) => item.id === params.accountId);
    if (!account) {
      throw new Error("Standalone account not found");
    }

    const plan = listStandalonePlans().find(
      (item) => item.plan === params.toPlan,
    );
    if (!plan || plan.plan === "free") {
      throw new Error("Choose a paid plan");
    }

    const existingPending = data.billingRequests.find(
      (request) =>
        request.accountId === params.accountId &&
        request.toPlan === params.toPlan &&
        request.status === "pending",
    );
    if (existingPending) {
      return existingPending;
    }

    const now = nowIso();
    const request: StandaloneBillingRequest = {
      id: createId("billreq"),
      accountId: params.accountId,
      fromPlan: account.plan,
      toPlan: params.toPlan,
      billingCycle: params.billingCycle ?? "monthly",
      status: "pending",
      checkoutUrl: `mailto:sales@taku.lat?subject=${encodeURIComponent(
        `Start TAKU WA ${plan.name}`,
      )}&body=${encodeURIComponent(
        `Account: ${account.email}\nProject: ${account.projectName}\nPlan: ${plan.name}\nBilling cycle: monthly`,
      )}`,
      provider: "manual",
      providerPreferenceId: null,
      providerSubscriptionId: null,
      providerCheckoutUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    data.billingRequests.push(request);
    await writeData(params.filePath, data);
    return request;
  });
}

export async function updateStandaloneBillingRequestCheckout(params: {
  filePath: string;
  accountId: string;
  billingRequestId: string;
  provider: "manual" | "mercadopago" | "mercadopago_preapproval";
  providerPreferenceId: string | null;
  providerSubscriptionId?: string | null;
  checkoutUrl: string;
}): Promise<StandaloneBillingRequest> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const request = data.billingRequests.find(
      (item) =>
        item.accountId === params.accountId &&
        item.id === params.billingRequestId,
    );
    if (!request) {
      throw new Error("Billing request not found");
    }

    request.provider = params.provider;
    request.providerPreferenceId = params.providerPreferenceId;
    request.providerSubscriptionId = params.providerSubscriptionId ?? null;
    request.providerCheckoutUrl = params.checkoutUrl;
    request.checkoutUrl = params.checkoutUrl;
    request.updatedAt = nowIso();

    await writeData(params.filePath, data);
    return request;
  });
}

export async function completeStandaloneBillingRequest(params: {
  filePath: string;
  billingRequestId: string;
  providerPaymentId: string;
  amountUsd: number;
  paidAt: string;
}): Promise<{
  account: StandaloneAccount;
  billingRequest: StandaloneBillingRequest;
  subscription: StandaloneSubscription;
  invoice: StandaloneInvoice;
}> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const billingRequest = data.billingRequests.find(
      (request) => request.id === params.billingRequestId,
    );
    if (!billingRequest) {
      throw new Error("Billing request not found");
    }

    const account = data.accounts.find(
      (item) => item.id === billingRequest.accountId,
    );
    if (!account) {
      throw new Error("Standalone account not found");
    }

    const now = nowIso();
    account.plan = billingRequest.toPlan;
    account.updatedAt = now;
    billingRequest.status = "completed";
    billingRequest.updatedAt = now;

    const periodStart = params.paidAt;
    const periodEnd = addMonths(params.paidAt, 1);
    let subscription = data.subscriptions.find(
      (item) => item.accountId === account.id,
    );
    if (!subscription) {
      subscription = {
        accountId: account.id,
        plan: account.plan,
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gracePeriodEnd: null,
        provider: "mercadopago",
        providerSubscriptionId: billingRequest.providerSubscriptionId ?? null,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      };
      data.subscriptions.push(subscription);
    } else {
      subscription.plan = account.plan;
      subscription.status = "active";
      subscription.billingCycle = "monthly";
      subscription.currentPeriodStart = periodStart;
      subscription.currentPeriodEnd = periodEnd;
      subscription.gracePeriodEnd = null;
      subscription.provider = "mercadopago";
      subscription.providerSubscriptionId =
        billingRequest.providerSubscriptionId ??
        subscription.providerSubscriptionId ??
        null;
      subscription.cancelAtPeriodEnd = false;
      subscription.updatedAt = now;
    }

    const existingInvoice = data.invoices.find(
      (invoice) => invoice.providerPaymentId === params.providerPaymentId,
    );
    const plan =
      listStandalonePlans().find((item) => item.plan === account.plan) ??
      listStandalonePlans()[0];
    if (!plan) {
      throw new Error("Plan catalog is empty");
    }
    const invoice =
      existingInvoice ??
      ({
        id: createId("inv"),
        accountId: account.id,
        plan: account.plan,
        amountUsd: params.amountUsd,
        currency: "USD",
        status: "paid",
        description: `TAKU WA ${plan.name}`,
        periodStart,
        periodEnd,
        dueDate: periodStart,
        paidAt: params.paidAt,
        provider: "mercadopago",
        providerPaymentId: params.providerPaymentId,
        createdAt: now,
      } satisfies StandaloneInvoice);

    if (!existingInvoice) {
      data.invoices.push(invoice);
    }

    await writeData(params.filePath, data);
    return { account, billingRequest, subscription, invoice };
  });
}

export async function activateStandalonePreapprovalSubscription(params: {
  filePath: string;
  billingRequestId: string;
  providerSubscriptionId: string;
  activatedAt?: string;
  nextPaymentDate?: string | null;
}): Promise<{
  account: StandaloneAccount;
  billingRequest: StandaloneBillingRequest;
  subscription: StandaloneSubscription;
}> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const billingRequest = data.billingRequests.find(
      (request) => request.id === params.billingRequestId,
    );
    if (!billingRequest) {
      throw new Error("Billing request not found");
    }

    const account = data.accounts.find(
      (item) => item.id === billingRequest.accountId,
    );
    if (!account) {
      throw new Error("Standalone account not found");
    }

    const now = nowIso();
    const periodStart = params.activatedAt ?? now;
    const periodEnd = params.nextPaymentDate ?? addMonths(periodStart, 1);

    account.plan = billingRequest.toPlan;
    account.updatedAt = now;
    billingRequest.status = "completed";
    billingRequest.provider = "mercadopago_preapproval";
    billingRequest.providerSubscriptionId = params.providerSubscriptionId;
    billingRequest.updatedAt = now;

    let subscription = data.subscriptions.find(
      (item) => item.accountId === account.id,
    );
    if (!subscription) {
      subscription = {
        accountId: account.id,
        plan: account.plan,
        status: "active",
        billingCycle: "monthly",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gracePeriodEnd: null,
        provider: "mercadopago",
        providerSubscriptionId: params.providerSubscriptionId,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      };
      data.subscriptions.push(subscription);
    } else {
      subscription.plan = account.plan;
      subscription.status = "active";
      subscription.billingCycle = "monthly";
      subscription.currentPeriodStart = periodStart;
      subscription.currentPeriodEnd = periodEnd;
      subscription.gracePeriodEnd = null;
      subscription.provider = "mercadopago";
      subscription.providerSubscriptionId = params.providerSubscriptionId;
      subscription.cancelAtPeriodEnd = false;
      subscription.updatedAt = now;
    }

    await writeData(params.filePath, data);
    return { account, billingRequest, subscription };
  });
}

export async function updateStandaloneSubscriptionFromProvider(params: {
  filePath: string;
  providerSubscriptionId: string;
  status: "active" | "past_due" | "cancelled";
  nextPaymentDate?: string | null;
}): Promise<StandaloneSubscription | null> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const subscription = data.subscriptions.find(
      (item) => item.providerSubscriptionId === params.providerSubscriptionId,
    );
    if (!subscription) {
      return null;
    }

    const now = nowIso();
    subscription.status = params.status;
    subscription.updatedAt = now;

    if (params.status === "active") {
      subscription.gracePeriodEnd = null;
      if (params.nextPaymentDate) {
        subscription.currentPeriodEnd = params.nextPaymentDate;
      }
    } else if (params.status === "past_due") {
      subscription.gracePeriodEnd =
        subscription.gracePeriodEnd ??
        addDays(subscription.currentPeriodEnd ?? now, 7);
    } else {
      subscription.cancelAtPeriodEnd = true;
      subscription.gracePeriodEnd = subscription.currentPeriodEnd ?? now;
    }

    await writeData(params.filePath, data);
    return subscription;
  });
}

export async function getStandaloneEffectiveBilling(params: {
  filePath: string;
  accountId: string;
}): Promise<StandaloneEffectiveBilling> {
  const data = await readData(params.filePath);
  const account = data.accounts.find((item) => item.id === params.accountId);
  if (!account) {
    throw new Error("Standalone account not found");
  }

  const fallbackSubscription: StandaloneSubscription = {
    accountId: account.id,
    plan: account.plan,
    status: account.plan === "free" ? "free" : "active",
    billingCycle: "monthly",
    currentPeriodStart: account.plan === "free" ? null : account.updatedAt,
    currentPeriodEnd:
      account.plan === "free" ? null : addMonths(account.updatedAt, 1),
    gracePeriodEnd: null,
    provider: null,
    providerSubscriptionId: null,
    cancelAtPeriodEnd: false,
    updatedAt: account.updatedAt,
  };
  const subscription =
    data.subscriptions.find((item) => item.accountId === account.id) ??
    fallbackSubscription;

  const now = nowIso();
  const accessUntil =
    subscription.gracePeriodEnd ??
    subscription.currentPeriodEnd ??
    subscription.updatedAt;
  const billingRestricted =
    account.plan !== "free" &&
    (subscription.status === "cancelled" ||
      subscription.status === "past_due" ||
      subscription.status === "free") &&
    accessUntil <= now;

  const effectivePlan = billingRestricted ? "free" : account.plan;

  return {
    accountPlan: account.plan,
    effectivePlan,
    entitlements: getStandaloneEntitlements(effectivePlan),
    subscription,
    billingRestricted,
  };
}

export async function getStandaloneAdminOverview(params: {
  filePath: string;
}): Promise<StandaloneAdminOverview> {
  const data = await readData(params.filePath);
  const today = nowIso().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const planCounts: Record<StandalonePlan, number> = {
    free: 0,
    basic: 0,
    developer: 0,
    platform: 0,
    enterprise: 0,
  };

  for (const account of data.accounts) {
    planCounts[account.plan] += 1;
  }

  const subscriptionsByAccountId = new Map(
    data.subscriptions.map((subscription) => [
      subscription.accountId,
      subscription,
    ]),
  );
  const usageByAccountId = new Map<
    string,
    { messagesToday: number; messagesThisMonth: number }
  >();

  for (const usage of data.usageDays) {
    const current = usageByAccountId.get(usage.accountId) ?? {
      messagesToday: 0,
      messagesThisMonth: 0,
    };
    if (usage.date === today) {
      current.messagesToday += usage.messagesSent;
    }
    if (usage.date.startsWith(currentMonth)) {
      current.messagesThisMonth += usage.messagesSent;
    }
    usageByAccountId.set(usage.accountId, current);
  }

  const invoicesByAccountId = new Map<string, StandaloneInvoice[]>();
  for (const invoice of data.invoices) {
    const invoices = invoicesByAccountId.get(invoice.accountId) ?? [];
    invoices.push(invoice);
    invoicesByAccountId.set(invoice.accountId, invoices);
  }

  const activeSubscriptions = data.subscriptions.filter(
    (subscription) => subscription.status === "active",
  ).length;
  const pastDueSubscriptions = data.subscriptions.filter(
    (subscription) => subscription.status === "past_due",
  ).length;
  const cancelledSubscriptions = data.subscriptions.filter(
    (subscription) => subscription.status === "cancelled",
  ).length;
  const openInvoices = data.invoices.filter(
    (invoice) => invoice.status === "open",
  ).length;
  const paidInvoices = data.invoices.filter(
    (invoice) => invoice.status === "paid",
  ).length;
  const revenueThisMonthUsd = data.invoices
    .filter(
      (invoice) =>
        invoice.status === "paid" && invoice.paidAt?.startsWith(currentMonth),
    )
    .reduce((total, invoice) => total + invoice.amountUsd, 0);

  const nextDue = data.accounts
    .map((account) => {
      const subscription = subscriptionsByAccountId.get(account.id);
      if (!subscription?.currentPeriodEnd) {
        return null;
      }
      return {
        accountId: account.id,
        projectName: account.projectName,
        plan: subscription.plan,
        currentPeriodEnd: subscription.currentPeriodEnd,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) =>
      left.currentPeriodEnd.localeCompare(right.currentPeriodEnd),
    )
    .slice(0, 5);

  const accountSummaries = data.accounts
    .map((account) => {
      const usage = usageByAccountId.get(account.id) ?? {
        messagesToday: 0,
        messagesThisMonth: 0,
      };
      const subscription = subscriptionsByAccountId.get(account.id);
      const invoices = invoicesByAccountId.get(account.id) ?? [];

      return {
        id: account.id,
        name: account.name,
        email: account.email,
        projectName: account.projectName,
        plan: account.plan,
        connectionCount: account.connectionIds.length,
        connectionIds: account.connectionIds,
        messagesToday: usage.messagesToday,
        messagesThisMonth: usage.messagesThisMonth,
        subscriptionStatus:
          subscription?.status ?? (account.plan === "free" ? "free" : "active"),
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
        openInvoiceCount: invoices.filter(
          (invoice) => invoice.status === "open",
        ).length,
        passwordSetupRequired:
          account.passwordSetupRequired ?? account.plan !== "free",
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    totalAccounts: data.accounts.length,
    totalConnections: data.accounts.reduce(
      (total, account) => total + account.connectionIds.length,
      0,
    ),
    planCounts,
    billing: {
      activeSubscriptions,
      pastDueSubscriptions,
      cancelledSubscriptions,
      openInvoices,
      paidInvoices,
      revenueThisMonthUsd,
      nextDue,
    },
    usage: {
      messagesToday: Array.from(usageByAccountId.values()).reduce(
        (total, usage) => total + usage.messagesToday,
        0,
      ),
      messagesThisMonth: Array.from(usageByAccountId.values()).reduce(
        (total, usage) => total + usage.messagesThisMonth,
        0,
      ),
      topAccounts: accountSummaries
        .filter((account) => account.messagesThisMonth > 0)
        .sort((left, right) => right.messagesThisMonth - left.messagesThisMonth)
        .slice(0, 5)
        .map((account) => ({
          accountId: account.id,
          projectName: account.projectName,
          messagesThisMonth: account.messagesThisMonth,
        })),
    },
    support: {
      passwordSetupRequired: data.accounts.filter(
        (account) => account.passwordSetupRequired ?? account.plan !== "free",
      ).length,
      accountsWithoutPhones: data.accounts.filter(
        (account) => account.connectionIds.length === 0,
      ).length,
      pendingBillingRequests: data.billingRequests.filter(
        (request) => request.status === "pending",
      ).length,
      pendingPaymentIntents: data.paymentIntents.filter(
        (intent) => intent.status === "pending" || intent.status === "paid",
      ).length,
    },
    accounts: accountSummaries,
  };
}

export async function createStandalonePaymentMethod(params: {
  filePath: string;
  accountId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
}): Promise<StandalonePaymentMethod> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const account = data.accounts.find((item) => item.id === params.accountId);
    if (!account) {
      throw new Error("Standalone account not found");
    }

    const now = nowIso();
    const hasDefault = data.paymentMethods.some(
      (method) => method.accountId === params.accountId && method.isDefault,
    );
    const method: StandalonePaymentMethod = {
      id: createId("pm"),
      accountId: params.accountId,
      brand: params.brand,
      last4: params.last4,
      expMonth: params.expMonth,
      expYear: params.expYear,
      holderName: params.holderName,
      isDefault: !hasDefault,
      createdAt: now,
      updatedAt: now,
    };

    data.paymentMethods.push(method);
    await writeData(params.filePath, data);
    return method;
  });
}

export async function setDefaultStandalonePaymentMethod(params: {
  filePath: string;
  accountId: string;
  paymentMethodId: string;
}): Promise<StandalonePaymentMethod> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const method = data.paymentMethods.find(
      (item) =>
        item.accountId === params.accountId &&
        item.id === params.paymentMethodId,
    );
    if (!method) {
      throw new Error("Payment method not found");
    }

    for (const item of data.paymentMethods) {
      if (item.accountId === params.accountId) {
        item.isDefault = item.id === params.paymentMethodId;
        item.updatedAt = nowIso();
      }
    }

    await writeData(params.filePath, data);
    return method;
  });
}

export async function deleteStandalonePaymentMethod(params: {
  filePath: string;
  accountId: string;
  paymentMethodId: string;
}): Promise<boolean> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const before = data.paymentMethods.length;
    const deletedMethod = data.paymentMethods.find(
      (item) =>
        item.accountId === params.accountId &&
        item.id === params.paymentMethodId,
    );
    data.paymentMethods = data.paymentMethods.filter(
      (item) =>
        item.accountId !== params.accountId ||
        item.id !== params.paymentMethodId,
    );

    if (data.paymentMethods.length === before) {
      return false;
    }

    if (deletedMethod?.isDefault) {
      const nextDefault = data.paymentMethods.find(
        (item) => item.accountId === params.accountId,
      );
      if (nextDefault) {
        nextDefault.isDefault = true;
        nextDefault.updatedAt = nowIso();
      }
    }

    await writeData(params.filePath, data);
    return true;
  });
}

export async function addStandaloneConnection(params: {
  filePath: string;
  accountId: string;
  connectionId: string;
}): Promise<StandaloneAccount> {
  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const account = data.accounts.find((item) => item.id === params.accountId);
    if (!account) {
      throw new Error("Standalone account not found");
    }

    if (!account.connectionIds.includes(params.connectionId)) {
      account.connectionIds.push(params.connectionId);
      account.updatedAt = nowIso();
      await writeData(params.filePath, data);
    }

    return account;
  });
}
