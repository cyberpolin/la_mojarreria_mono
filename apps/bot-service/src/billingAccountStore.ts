import { readJson, writeJson } from "./jsonStore.js";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type BotBillingTier = "free" | "on_demand" | "high_usage";
export type BotBillingStatus = "active" | "blocked" | "suspended";

export type BotBillingAccount = {
  clientId: string;
  clientTokenHash?: string;
  tier: BotBillingTier;
  status: BotBillingStatus;
  monthlyPeriod: string;
  monthlyIncludedUsd: number;
  monthlyIncludedUsedUsd: number;
  prepaidBalanceUsd: number;
  markupPercent: number;
  createdAt: string;
  updatedAt: string;
};

export type BotBillingRules = {
  freeMonthlyIncludedUsd: number;
  freeMarkupPercent: number;
  onDemandMarkupPercent: number;
  highUsageMarkupPercent: number;
};

type BillingAccountStore = {
  accounts: BotBillingAccount[];
};

function nowIso() {
  return new Date().toISOString();
}

function currentMonthlyPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

export function createClientToken(): string {
  return `taku_bot_${randomBytes(24).toString("base64url")}`;
}

function hashClientToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyClientToken(
  account: BotBillingAccount,
  token: string,
): boolean {
  if (!account.clientTokenHash || !token.trim()) return false;

  const expected = Buffer.from(account.clientTokenHash, "hex");
  const actual = Buffer.from(hashClientToken(token.trim()), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function readStore(filePath: string): Promise<BillingAccountStore> {
  const store = await readJson<BillingAccountStore>(filePath, { accounts: [] });
  return {
    accounts: Array.isArray(store.accounts) ? store.accounts : [],
  };
}

function applyTierDefaults(account: BotBillingAccount, rules: BotBillingRules) {
  if (account.tier === "free") {
    account.monthlyIncludedUsd = rules.freeMonthlyIncludedUsd;
    account.markupPercent = rules.freeMarkupPercent;
  } else if (account.tier === "on_demand") {
    account.monthlyIncludedUsd = 0;
    account.markupPercent = rules.onDemandMarkupPercent;
  } else {
    account.monthlyIncludedUsd = 0;
    account.markupPercent = rules.highUsageMarkupPercent;
  }
}

function refreshMonthlyPeriod(
  account: BotBillingAccount,
  rules: BotBillingRules,
) {
  const period = currentMonthlyPeriod();
  if (account.monthlyPeriod !== period) {
    account.monthlyPeriod = period;
    account.monthlyIncludedUsedUsd = 0;
    if (account.status === "blocked") {
      account.status = "active";
    }
  }
  applyTierDefaults(account, rules);
}

function createFreeAccount(
  clientId: string,
  rules: BotBillingRules,
  clientToken?: string,
): BotBillingAccount {
  const now = nowIso();
  return {
    clientId,
    ...(clientToken ? { clientTokenHash: hashClientToken(clientToken) } : {}),
    tier: "free",
    status: "active",
    monthlyPeriod: currentMonthlyPeriod(),
    monthlyIncludedUsd: rules.freeMonthlyIncludedUsd,
    monthlyIncludedUsedUsd: 0,
    prepaidBalanceUsd: 0,
    markupPercent: rules.freeMarkupPercent,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getOrCreateBillingAccount(params: {
  filePath: string;
  clientId: string;
  rules: BotBillingRules;
  ensureClientToken?: boolean;
}): Promise<{ account: BotBillingAccount; clientToken: string | null }> {
  const store = await readStore(params.filePath);
  let account =
    store.accounts.find((item) => item.clientId === params.clientId) ?? null;

  if (!account) {
    const clientToken = params.ensureClientToken ? createClientToken() : null;
    account = createFreeAccount(
      params.clientId,
      params.rules,
      clientToken ?? undefined,
    );
    store.accounts.push(account);
    await writeJson(params.filePath, store);
    return { account, clientToken };
  }

  const previous = JSON.stringify(account);
  refreshMonthlyPeriod(account, params.rules);
  let clientToken: string | null = null;
  if (params.ensureClientToken && !account.clientTokenHash) {
    clientToken = createClientToken();
    account.clientTokenHash = hashClientToken(clientToken);
  }
  if (JSON.stringify(account) !== previous) {
    account.updatedAt = nowIso();
    await writeJson(params.filePath, store);
  }

  return { account, clientToken };
}

export async function getBillingAccount(params: {
  filePath: string;
  clientId: string;
  rules: BotBillingRules;
}): Promise<BotBillingAccount | null> {
  const store = await readStore(params.filePath);
  const account =
    store.accounts.find((item) => item.clientId === params.clientId) ?? null;
  if (!account) return null;

  const previous = JSON.stringify(account);
  refreshMonthlyPeriod(account, params.rules);
  if (JSON.stringify(account) !== previous) {
    account.updatedAt = nowIso();
    await writeJson(params.filePath, store);
  }

  return account;
}

export async function listBillingAccounts(params: {
  filePath: string;
  rules: BotBillingRules;
}): Promise<BotBillingAccount[]> {
  const store = await readStore(params.filePath);
  let changed = false;
  for (const account of store.accounts) {
    const previous = JSON.stringify(account);
    refreshMonthlyPeriod(account, params.rules);
    if (JSON.stringify(account) !== previous) {
      account.updatedAt = nowIso();
      changed = true;
    }
  }

  if (changed) {
    await writeJson(params.filePath, store);
  }

  return store.accounts
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function debitBillingAccount(params: {
  filePath: string;
  clientId: string;
  chargeUsd: number;
  rules: BotBillingRules;
}): Promise<BotBillingAccount> {
  const store = await readStore(params.filePath);
  let account =
    store.accounts.find((item) => item.clientId === params.clientId) ?? null;

  if (!account) {
    account = createFreeAccount(params.clientId, params.rules);
    store.accounts.push(account);
  }

  refreshMonthlyPeriod(account, params.rules);
  if (account.tier === "free") {
    account.monthlyIncludedUsedUsd = roundUsd(
      account.monthlyIncludedUsedUsd + params.chargeUsd,
    );
    if (account.monthlyIncludedUsedUsd >= account.monthlyIncludedUsd) {
      account.status = "blocked";
    }
  } else {
    account.prepaidBalanceUsd = roundUsd(
      account.prepaidBalanceUsd - params.chargeUsd,
    );
    if (account.prepaidBalanceUsd <= 0) {
      account.status = "blocked";
    }
  }

  account.updatedAt = nowIso();
  await writeJson(params.filePath, store);
  return account;
}

export async function creditPrepaidBillingAccount(params: {
  filePath: string;
  clientId: string;
  tier: Exclude<BotBillingTier, "free">;
  amountUsd: number;
  rules: BotBillingRules;
}): Promise<BotBillingAccount> {
  const store = await readStore(params.filePath);
  let account =
    store.accounts.find((item) => item.clientId === params.clientId) ?? null;

  if (!account) {
    account = createFreeAccount(params.clientId, params.rules);
    store.accounts.push(account);
  }

  account.tier = params.tier;
  account.status = "active";
  refreshMonthlyPeriod(account, params.rules);
  account.prepaidBalanceUsd = roundUsd(
    account.prepaidBalanceUsd + params.amountUsd,
  );
  account.updatedAt = nowIso();

  await writeJson(params.filePath, store);
  return account;
}

export function getBillingAllowance(account: BotBillingAccount) {
  if (account.tier === "free") {
    return {
      includedRemainingUsd: roundUsd(
        Math.max(
          0,
          account.monthlyIncludedUsd - account.monthlyIncludedUsedUsd,
        ),
      ),
      prepaidRemainingUsd: 0,
    };
  }

  return {
    includedRemainingUsd: 0,
    prepaidRemainingUsd: roundUsd(Math.max(0, account.prepaidBalanceUsd)),
  };
}
