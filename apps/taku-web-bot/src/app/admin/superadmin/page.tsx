"use client";

import { useEffect, useState } from "react";

type PaymentIntent = {
  id: string;
  toPlan: string;
  status: string;
  amountUsd: number;
  providerPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
};

type AccountSummary = {
  clientId: string;
  tier: string;
  status: string;
  monthlyPeriod: string;
  monthlyIncludedUsd: number;
  monthlyIncludedUsedUsd: number;
  includedRemainingUsd: number;
  prepaidBalanceUsd: number;
  prepaidRemainingUsd: number;
  markupPercent: number;
  requests: number;
  totalTokens: number;
  estimatedProviderCostUsd: number;
  estimatedChargeUsd: number;
  createdAt: string;
  updatedAt: string;
};

type UsageRow = {
  clientId?: string;
  assistantId?: string;
  requests: number;
  totalTokens: number;
  estimatedProviderCostUsd: number;
  estimatedChargeUsd: number;
};

type AdminOverview = {
  totalAccounts: number;
  tierCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  billing: {
    totalPrepaidBalanceUsd: number;
    totalIncludedRemainingUsd: number;
    paymentStatusCounts: Record<string, number>;
    paidAmountUsd: number;
    recentPaymentIntents: PaymentIntent[];
  };
  usage: {
    requests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokens: number;
    estimatedProviderCostUsd: number;
    estimatedChargeUsd: number;
    estimatedMarginUsd: number;
    averageLatencyMs: number;
    topClients: UsageRow[];
    topAssistants: UsageRow[];
  };
  accounts: AccountSummary[];
};

type OverviewResponse =
  | { ok: true; overview: AdminOverview }
  | { ok: false; error: string };

type UsageEvent = {
  id: string;
  requestId: string;
  clientId: string | null;
  assistantId: string | null;
  billingTier?: string | null;
  model: string;
  status: "success" | "error";
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedProviderCostUsd?: number;
  estimatedChargeUsd?: number;
  chargeMarkupPercent?: number;
  latencyMs: number;
  errorCode: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  httpStatus?: number | null;
  errorMetadata?: Record<string, unknown> | null;
  createdAt: string;
};

type EventsResponse =
  | { ok: true; events: UsageEvent[] }
  | { ok: false; error: string };

function readIsSuperAdminSession() {
  try {
    const rawSession = window.localStorage.getItem("TAKU_BOT_SESSION");
    if (!rawSession) return false;
    const session = JSON.parse(rawSession) as {
      account?: { role?: unknown };
    };
    return session.account?.role === "superadmin";
  } catch {
    return false;
  }
}

function logout() {
  window.localStorage.removeItem("TAKU_BOT_SESSION");
  window.location.href = "/";
}

function numberText(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "-";
}

function usdText(value: number | null | undefined) {
  return typeof value === "number" ? `$${value.toFixed(4)}` : "-";
}

function dateText(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function dateTimeText(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "-";
}

function Metric(params: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {params.label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">
        {params.value}
      </p>
    </div>
  );
}

export default function BotSuperadminPage() {
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [errorEvents, setErrorEvents] = useState<UsageEvent[]>([]);
  const [status, setStatus] = useState("Loading dashboard");
  const [isLoading, setIsLoading] = useState(true);

  async function loadOverview(superadmin = isSuperadmin) {
    if (!superadmin) {
      setIsLoading(false);
      setStatus("Superadmin access required");
      return;
    }

    setIsLoading(true);
    setStatus("Loading dashboard");
    try {
      const roleHeaders = { "x-taku-role": "superadmin" };
      const [response, eventsResponse] = await Promise.all([
        fetch("/api/bot/admin/overview", {
          cache: "no-store",
          headers: roleHeaders,
        }),
        fetch("/api/bot/usage/events?limit=100", {
          cache: "no-store",
          headers: roleHeaders,
        }),
      ]);
      const payload = (await response
        .json()
        .catch(() => null)) as OverviewResponse | null;
      const eventsPayload = (await eventsResponse
        .json()
        .catch(() => null)) as EventsResponse | null;

      if (!response.ok || !payload?.ok) {
        setStatus(
          payload && "error" in payload
            ? payload.error
            : `Dashboard failed with HTTP ${response.status}`,
        );
        return;
      }

      setOverview(payload.overview);
      if (eventsResponse.ok && eventsPayload?.ok) {
        setErrorEvents(
          eventsPayload.events.filter((event) => event.status === "error"),
        );
        setStatus("Dashboard loaded");
      } else {
        setErrorEvents([]);
        setStatus("Dashboard loaded. Completion errors could not be loaded.");
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not load dashboard",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const superadmin = readIsSuperAdminSession();
    setIsSuperadmin(superadmin);
    void loadOverview(superadmin);
  }, []);

  if (!isSuperadmin) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
          <a href="/" className="text-sm font-bold tracking-[0.2em]">
            TAKU BOT
          </a>
          <a
            href="/login"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Login
          </a>
        </nav>
        <section className="mx-auto w-full max-w-3xl px-4 py-16 md:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Superadmin
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              Access required.
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Log in with the configured TAKU Bot superadmin credentials.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU BOT
        </a>
        <div className="flex items-center gap-2">
          <a
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Assistants
          </a>
          <a
            href="/admin/usage"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Usage
          </a>
          <button
            type="button"
            onClick={logout}
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Logout
          </button>
        </div>
      </nav>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              TAKU Bot Superadmin
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 md:text-5xl">
              Platform dashboard
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Monitor client billing, usage, provider cost, and margin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={isLoading}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {isLoading ? "Refreshing" : "Refresh"}
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-600">{status}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Metric
            label="Accounts"
            value={numberText(overview?.totalAccounts)}
          />
          <Metric
            label="Charge estimate"
            value={usdText(overview?.usage.estimatedChargeUsd)}
          />
          <Metric
            label="Provider cost"
            value={usdText(overview?.usage.estimatedProviderCostUsd)}
          />
          <Metric
            label="Margin"
            value={usdText(overview?.usage.estimatedMarginUsd)}
          />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              1. Accounts
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Tier mix
            </h2>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {["free", "on_demand", "high_usage"].map((tier) => (
                <div
                  key={tier}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-xs font-semibold capitalize text-slate-500">
                    {tier.replace("_", " ")}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {overview?.tierCounts[tier] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              2. Billing
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Balances and payments
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Active", overview?.statusCounts.active ?? 0],
                ["Blocked", overview?.statusCounts.blocked ?? 0],
                ["Suspended", overview?.statusCounts.suspended ?? 0],
                [
                  "Paid payments",
                  overview?.billing.paymentStatusCounts.paid ?? 0,
                ],
                [
                  "Pending payments",
                  overview?.billing.paymentStatusCounts.pending ?? 0,
                ],
                ["Paid amount", usdText(overview?.billing.paidAmountUsd)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-xs font-semibold text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              3. Usage
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Token volume
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric
                label="Requests"
                value={numberText(overview?.usage.requests)}
              />
              <Metric
                label="Tokens"
                value={numberText(overview?.usage.totalTokens)}
              />
            </div>
            <div className="mt-5 grid gap-2">
              {(overview?.usage.topClients ?? []).map((client) => (
                <div
                  key={client.clientId}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="break-all font-medium text-slate-950">
                    {client.clientId}
                  </span>
                  <span className="text-slate-600">
                    {numberText(client.totalTokens)} tokens
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              4. Assistants
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Top usage
            </h2>
            <div className="mt-5 grid gap-2">
              {(overview?.usage.topAssistants ?? []).map((assistant) => (
                <div
                  key={assistant.assistantId}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="break-all font-medium text-slate-950">
                    {assistant.assistantId}
                  </span>
                  <span className="text-slate-600">
                    {usdText(assistant.estimatedChargeUsd)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Accounts
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Bot clients
          </h2>
          <div className="mt-5 grid gap-3">
            {overview?.accounts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No billing accounts yet. Accounts are created on first
                completion request with a `client_id`.
              </div>
            ) : null}

            {overview?.accounts.map((account) => (
              <article
                key={account.clientId}
                className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-all font-semibold text-slate-950">
                      {account.clientId}
                    </h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {account.tier.replace("_", " ")}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {account.status}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {account.markupPercent}% markup
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
                    <div>
                      <dt className="font-semibold text-slate-950">Requests</dt>
                      <dd>{numberText(account.requests)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">Charge</dt>
                      <dd>{usdText(account.estimatedChargeUsd)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">Provider</dt>
                      <dd>{usdText(account.estimatedProviderCostUsd)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">
                        Remaining
                      </dt>
                      <dd>
                        {account.tier === "free"
                          ? usdText(account.includedRemainingUsd)
                          : usdText(account.prepaidRemainingUsd)}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="text-sm text-slate-600 md:text-right">
                  <p className="font-semibold text-slate-950">
                    {numberText(account.totalTokens)} tokens
                  </p>
                  <p className="mt-1">Period {account.monthlyPeriod}</p>
                  <p className="mt-1">Updated {dateText(account.updatedAt)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Completion errors
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Recent failed requests
              </h2>
            </div>
            <a
              href="/admin/usage"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
            >
              Open usage
            </a>
          </div>

          <div className="mt-5 grid gap-3">
            {errorEvents.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No recent completion errors found in usage events.
              </div>
            ) : null}

            {errorEvents.map((event) => (
              <article
                key={event.id}
                className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {event.errorCode ?? "UNKNOWN_ERROR"}
                    </span>
                    {event.httpStatus ? (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        HTTP {event.httpStatus}
                      </span>
                    ) : null}
                    {event.errorType ? (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {event.errorType}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {event.billingTier ?? "no tier"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {event.model}
                    </span>
                  </div>
                  {event.errorMessage ? (
                    <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
                      {event.errorMessage}
                    </p>
                  ) : null}
                  {event.errorMetadata ? (
                    <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                      {JSON.stringify(event.errorMetadata, null, 2)}
                    </pre>
                  ) : null}
                  <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold text-slate-950">Client</dt>
                      <dd className="break-all">{event.clientId ?? "-"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">
                        Assistant
                      </dt>
                      <dd className="break-all">{event.assistantId ?? "-"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">Request</dt>
                      <dd className="break-all">{event.requestId}</dd>
                    </div>
                  </dl>
                </div>
                <div className="text-slate-600 md:text-right">
                  <p className="font-semibold text-slate-950">
                    {numberText(event.latencyMs)}ms
                  </p>
                  <p className="mt-1">{dateTimeText(event.createdAt)}</p>
                  <p className="mt-1">{usdText(event.estimatedChargeUsd)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Payments
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Recent Mercado Pago intents
          </h2>
          <div className="mt-5 grid gap-3">
            {(overview?.billing.recentPaymentIntents ?? []).map((intent) => (
              <div
                key={intent.id}
                className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="break-all font-semibold text-slate-950">
                    {intent.id}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {intent.toPlan} · {intent.status}
                  </p>
                </div>
                <div className="text-slate-600 md:text-right">
                  <p className="font-semibold text-slate-950">
                    {usdText(intent.amountUsd)}
                  </p>
                  <p>{dateText(intent.paidAt ?? intent.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
