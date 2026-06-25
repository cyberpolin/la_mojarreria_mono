"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type StandalonePlan =
  | "free"
  | "basic"
  | "developer"
  | "platform"
  | "enterprise";

type Account = {
  id: string;
  name: string;
  email: string;
  projectName: string;
  plan: StandalonePlan;
  connectionIds: string[];
};

type Entitlements = {
  connectionLimit: number | null;
  dailyMessageLimit: number | null;
  webhooksEnabled: boolean;
};

type PlanCatalogItem = {
  plan: StandalonePlan;
  name: string;
  monthlyPriceUsd: number | null;
  description: string;
  features: string[];
  entitlements: Entitlements;
};

type BillingRequest = {
  id: string;
  accountId: string;
  fromPlan: StandalonePlan;
  toPlan: StandalonePlan;
  billingCycle: "monthly";
  status: "pending" | "completed" | "cancelled";
  checkoutUrl: string;
  provider: "manual" | "mercadopago" | "mercadopago_preapproval";
  providerPreferenceId: string | null;
  providerSubscriptionId?: string | null;
  providerCheckoutUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type Subscription = {
  accountId: string;
  plan: StandalonePlan;
  status: "free" | "active" | "past_due" | "cancelled";
  billingCycle: "monthly";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEnd?: string | null;
  provider?: "manual" | "mercadopago" | null;
  providerSubscriptionId?: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
};

type Invoice = {
  id: string;
  accountId: string;
  plan: StandalonePlan;
  amountUsd: number;
  currency: "USD";
  status: "paid" | "open" | "void";
  description: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
};

type PaymentMethod = {
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

type BillingResponse =
  | {
      ok: true;
      account: Account;
      plans: PlanCatalogItem[];
      currentPlan: PlanCatalogItem;
      subscription: Subscription;
      invoices: Invoice[];
      paymentMethods: PaymentMethod[];
      billingRequests: BillingRequest[];
    }
  | { ok: false; error: string };

type CheckoutResponse =
  | {
      ok: true;
      billingRequest: BillingRequest;
      checkoutUrl: string;
    }
  | { ok: false; error: string };

type SessionStorageValue = {
  sessionToken?: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_API_BASE_URL ?? "http://localhost:3001";

function loadSessionToken(): string | null {
  try {
    const raw = window.localStorage.getItem("TAKU_WA_SIGNUP_RESULT");
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SessionStorageValue;
    return parsed.sessionToken ?? null;
  } catch {
    return null;
  }
}

function formatPrice(plan: PlanCatalogItem): string {
  if (plan.monthlyPriceUsd === null) {
    return "Custom";
  }

  if (plan.monthlyPriceUsd === 0) {
    return "Free";
  }

  return `$${plan.monthlyPriceUsd}/mo`;
}

function formatLimit(value: number | null): string {
  return value === null ? "Unlimited" : String(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

export default function BillingPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [plans, setPlans] = useState<PlanCatalogItem[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PlanCatalogItem | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [billingRequests, setBillingRequests] = useState<BillingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submittingPlan, setSubmittingPlan] = useState<StandalonePlan | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latestRequest = useMemo(
    () => billingRequests.find((request) => request.status === "pending"),
    [billingRequests],
  );

  const apiFetch = useCallback(async function apiFetch<T>(
    path: string,
    token: string,
    init?: RequestInit,
  ): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-session-token": token,
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await response.json()) as T;
    if (!response.ok) {
      const maybeError = payload as { error?: string };
      throw new Error(maybeError.error ?? "Request failed");
    }

    return payload;
  }, []);

  const loadBilling = useCallback(
    async function loadBilling(token: string) {
      setError(null);
      const payload = await apiFetch<BillingResponse>(
        "/v1/account/billing",
        token,
      );
      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setAccount(payload.account);
      setPlans(payload.plans);
      setCurrentPlan(payload.currentPlan);
      setSubscription(payload.subscription);
      setInvoices(payload.invoices);
      setPaymentMethods(payload.paymentMethods);
      setBillingRequests(payload.billingRequests);
    },
    [apiFetch],
  );

  useEffect(() => {
    const token = loadSessionToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setSessionToken(token);
    loadBilling(token)
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load billing",
        );
      })
      .finally(() => setIsLoading(false));
  }, [loadBilling]);

  function requestCheckout(plan: StandalonePlan) {
    if (!sessionToken) {
      return;
    }

    setSubmittingPlan(plan);
    setError(null);
    setNotice(null);
    void apiFetch<CheckoutResponse>(
      "/v1/account/billing/checkout",
      sessionToken,
      {
        method: "POST",
        body: JSON.stringify({ plan, billingCycle: "monthly" }),
      },
    )
      .then((payload) => {
        if (!payload.ok) {
          throw new Error(payload.error);
        }

        setBillingRequests((current) => [
          payload.billingRequest,
          ...current.filter(
            (request) => request.id !== payload.billingRequest.id,
          ),
        ]);
        setNotice(
          "Mercado Pago subscription checkout created. Continue to activate.",
        );
        window.location.href = payload.checkoutUrl;
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not start checkout",
        );
      })
      .finally(() => setSubmittingPlan(null));
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU
        </a>
        <a
          href="/admin"
          className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
        >
          Back to admin
        </a>
      </nav>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Billing
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 md:text-5xl">
              {account?.projectName ?? "Account billing"}
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Manage your TAKU WA plan and upgrade requests.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Current plan
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {currentPlan?.name ?? "-"}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {notice}
          </div>
        ) : null}

        {latestRequest ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">
              Pending billing request
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              You requested {latestRequest.toPlan}. Continue in Mercado Pago to
              authorize recurring billing.
            </p>
            <a
              href={latestRequest.checkoutUrl}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-800"
            >
              Continue Mercado Pago subscription
            </a>
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Status
            </p>
            <p className="mt-3 text-2xl font-semibold capitalize text-slate-950">
              {subscription?.status ?? "-"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Next due date
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {formatDate(subscription?.currentPeriodEnd ?? null)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Card handling
            </p>
            <p className="mt-3 text-lg font-semibold text-slate-950">
              {paymentMethods.find((method) => method.isDefault)
                ? `**** ${paymentMethods.find((method) => method.isDefault)?.last4}`
                : "Mercado Pago"}
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Payment methods
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Mercado Pago collects and charges cards for subscriptions. TAKU
                keeps only masked records and billing history.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="grid gap-3">
              {paymentMethods.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No synced payment methods yet. Add or update a card from the
                  Mercado Pago subscription checkout.
                </div>
              ) : null}

              {paymentMethods.map((method) => (
                <article
                  key={method.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {method.brand} ending in {method.last4}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {method.holderName} · expires {method.expMonth}/
                        {method.expYear}
                      </p>
                    </div>
                    {method.isDefault ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Default
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Manage cards
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                To add or change a card, start the Mercado Pago subscription
                flow for the plan you want. Card data stays with Mercado Pago.
              </p>
              {currentPlan && currentPlan.plan !== "free" ? (
                <button
                  type="button"
                  onClick={() => requestCheckout(currentPlan.plan)}
                  disabled={submittingPlan === currentPlan.plan}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submittingPlan === currentPlan.plan
                    ? "Opening..."
                    : "Update subscription"}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="text-xl font-semibold text-slate-950">
            Billing history
          </h2>
          <div className="mt-5 grid gap-3">
            {invoices.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No invoices yet.
              </div>
            ) : null}

            {invoices.map((invoice) => (
              <article
                key={invoice.id}
                className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {invoice.description}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDate(invoice.periodStart)} -{" "}
                    {formatDate(invoice.periodEnd)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-950">
                  ${invoice.amountUsd} {invoice.currency}
                </p>
                <p className="text-sm capitalize text-slate-600">
                  {invoice.status} · due {formatDate(invoice.dueDate)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Loading plans...
            </div>
          ) : null}

          {plans.map((plan) => {
            const isCurrentPlan = account?.plan === plan.plan;
            const isFree = plan.plan === "free";
            const isSubmitting = submittingPlan === plan.plan;

            return (
              <article
                key={plan.plan}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">
                      {plan.name}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {plan.description}
                    </p>
                  </div>
                  {isCurrentPlan ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Current
                    </span>
                  ) : null}
                </div>

                <p className="mt-5 text-3xl font-semibold text-slate-950">
                  {formatPrice(plan)}
                </p>

                <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                  <div>
                    <dt className="font-medium text-slate-950">Connections</dt>
                    <dd className="mt-1">
                      {formatLimit(plan.entitlements.connectionLimit)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-950">
                      Daily messages
                    </dt>
                    <dd className="mt-1">
                      {formatLimit(plan.entitlements.dailyMessageLimit)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-950">Webhooks</dt>
                    <dd className="mt-1">
                      {plan.entitlements.webhooksEnabled ? "Included" : "No"}
                    </dd>
                  </div>
                </dl>

                <ul className="mt-5 grid gap-2 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature}>- {feature}</li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => requestCheckout(plan.plan)}
                  disabled={isCurrentPlan || isFree || isSubmitting}
                  className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isCurrentPlan
                    ? "Current plan"
                    : isFree
                      ? "Free plan"
                      : isSubmitting
                        ? "Starting checkout..."
                        : plan.monthlyPriceUsd === null
                          ? "Contact sales"
                          : `Subscribe $${plan.monthlyPriceUsd}/mo`}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
