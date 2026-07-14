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

type BillingResponse =
  | {
      ok: true;
      account: Account;
      plans: PlanCatalogItem[];
      currentPlan: PlanCatalogItem;
      subscription: Subscription;
      invoices: Invoice[];
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

type CardPaymentResponse =
  | {
      ok: true;
      billingRequest: BillingRequest;
      subscription: Subscription;
      invoice: Invoice;
      paymentStatus?: string;
    }
  | {
      ok: false;
      error: string;
      paymentStatus?: string;
      paymentStatusDetail?: string | null;
      providerStatus?: number;
      providerError?: string | null;
      providerCauses?: Array<{
        code: string | null;
        description: string | null;
        data: string | null;
      }>;
    };

type SessionStorageValue = {
  sessionToken?: string;
};

type CardPaymentFormData = {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number;
  installments?: string | number;
  payer: {
    email: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
};

type MercadoPagoCardFormData = {
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments?: string;
  cardholderEmail: string;
  identificationType?: string;
  identificationNumber?: string;
};

type MercadoPagoCardForm = {
  getCardFormData: () => MercadoPagoCardFormData;
};

type MercadoPagoInstance = {
  cardForm: (settings: {
    amount: string;
    iframe: boolean;
    form: {
      id: string;
      cardNumber: { id: string; placeholder: string };
      expirationDate: { id: string; placeholder: string };
      securityCode: { id: string; placeholder: string };
      cardholderName: { id: string; placeholder: string };
      issuer: { id: string; placeholder: string };
      installments: { id: string; placeholder: string };
      identificationType?: { id: string; placeholder: string };
      identificationNumber?: { id: string; placeholder: string };
      cardholderEmail: { id: string; placeholder: string };
    };
    callbacks: {
      onFormMounted: (error?: unknown) => void;
      onSubmit: (event: Event) => void;
      onFetching: () => () => void;
    };
  }) => MercadoPagoCardForm;
};

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string },
    ) => MercadoPagoInstance;
    takuWaBillingCardForm?: MercadoPagoCardForm;
  }
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_API_BASE_URL ?? "http://localhost:3001";
const mercadoPagoPublicKey =
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.MercadoPago) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://sdk.mercadopago.com/js/v2"]',
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Could not load Mercado Pago SDK")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Mercado Pago SDK"));
    document.head.appendChild(script);
  });
}

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
  const [billingRequests, setBillingRequests] = useState<BillingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submittingPlan, setSubmittingPlan] = useState<StandalonePlan | null>(
    null,
  );
  const [cardRequest, setCardRequest] = useState<BillingRequest | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [installmentsReady, setInstallmentsReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latestRequest = useMemo(
    () => billingRequests.find((request) => request.status === "pending"),
    [billingRequests],
  );
  const cardPlan = useMemo(
    () =>
      cardRequest
        ? (plans.find((plan) => plan.plan === cardRequest.toPlan) ?? null)
        : null,
    [cardRequest, plans],
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
        setCardRequest(payload.billingRequest);
        setNotice("Enter card details to submit the subscription payment.");
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

  const processCardPayment = useCallback(
    async function processCardPayment(formData: CardPaymentFormData) {
      if (!sessionToken || !cardRequest) {
        return;
      }

      setSubmittingPlan(cardRequest.toPlan);
      setError(null);
      setNotice(null);

      try {
        const payload = await apiFetch<CardPaymentResponse>(
          "/v1/account/billing/card-payment",
          sessionToken,
          {
            method: "POST",
            body: JSON.stringify({
              billingRequestId: cardRequest.id,
              plan: cardRequest.toPlan,
              ...formData,
            }),
          },
        );

        if (!payload.ok) {
          throw new Error(
            [
              payload.error,
              payload.paymentStatusDetail
                ? `Detail: ${payload.paymentStatusDetail}`
                : null,
              payload.providerCauses?.length
                ? payload.providerCauses
                    .map((cause) => cause.description ?? cause.code)
                    .filter(Boolean)
                    .join(", ")
                : null,
            ]
              .filter(Boolean)
              .join(" - "),
          );
        }

        setSubscription(payload.subscription);
        setInvoices((current) => [
          payload.invoice,
          ...current.filter((invoice) => invoice.id !== payload.invoice.id),
        ]);
        setBillingRequests((current) =>
          current.map((request) =>
            request.id === payload.billingRequest.id
              ? payload.billingRequest
              : request,
          ),
        );
        setCardRequest(null);
        setNotice("Payment approved. Subscription is active.");
        await loadBilling(sessionToken);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not process card payment",
        );
      } finally {
        setSubmittingPlan(null);
      }
    },
    [apiFetch, cardRequest, loadBilling, sessionToken],
  );

  useEffect(() => {
    if (!cardRequest) {
      return;
    }

    const activeCardRequest = cardRequest;
    const selectedPlan = plans.find(
      (plan) => plan.plan === activeCardRequest.toPlan,
    );
    if (!selectedPlan?.monthlyPriceUsd) {
      return;
    }
    const selectedAmount = selectedPlan.monthlyPriceUsd;
    const selectedRequestPlan = activeCardRequest.toPlan;

    let cancelled = false;
    let installmentsTimer: number | null = null;

    function checkInstallmentsReady() {
      const select = document.getElementById(
        "taku-wa-billing-card-installments",
      ) as HTMLSelectElement | null;
      if (!select) {
        return;
      }

      const hasRealOption = Array.from(select.options).some(
        (option) =>
          option.value.trim().length > 0 &&
          option.textContent?.trim().length !== 0,
      );
      setInstallmentsReady(hasRealOption);
    }

    async function renderCardForm() {
      setCardReady(false);
      setCardError(null);
      setInstallmentsReady(false);

      try {
        if (!mercadoPagoPublicKey) {
          throw new Error("Mercado Pago public key is not configured.");
        }

        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago) {
          return;
        }

        const mercadoPago = new window.MercadoPago(mercadoPagoPublicKey, {
          locale: "es-MX",
        });
        let cardForm: MercadoPagoCardForm | null = null;
        cardForm = mercadoPago.cardForm({
          amount: String(selectedAmount),
          iframe: true,
          form: {
            id: "taku-wa-billing-card-form",
            cardNumber: {
              id: "taku-wa-billing-card-number",
              placeholder: "Card number",
            },
            expirationDate: {
              id: "taku-wa-billing-card-expiration",
              placeholder: "MM/YY",
            },
            securityCode: {
              id: "taku-wa-billing-card-security-code",
              placeholder: "CVV",
            },
            cardholderName: {
              id: "taku-wa-billing-cardholder-name",
              placeholder: "Name on card",
            },
            issuer: {
              id: "taku-wa-billing-card-issuer",
              placeholder: "Issuer",
            },
            installments: {
              id: "taku-wa-billing-card-installments",
              placeholder: "Installments",
            },
            cardholderEmail: {
              id: "taku-wa-billing-cardholder-email",
              placeholder: "Email",
            },
          },
          callbacks: {
            onFormMounted: (formError) => {
              if (cancelled) {
                return;
              }

              if (formError) {
                console.error(formError);
                setCardError("Mercado Pago card form could not be loaded.");
                return;
              }

              setCardReady(true);
              installmentsTimer = window.setInterval(
                checkInstallmentsReady,
                300,
              );
            },
            onSubmit: (event) => {
              event.preventDefault();
              if (!cardForm) {
                return;
              }

              const data = cardForm.getCardFormData();
              void processCardPayment({
                token: data.token,
                payment_method_id: data.paymentMethodId,
                issuer_id: data.issuerId,
                installments: data.installments || "1",
                payer: {
                  email: data.cardholderEmail,
                  identification:
                    data.identificationType && data.identificationNumber
                      ? {
                          type: data.identificationType,
                          number: data.identificationNumber,
                        }
                      : undefined,
                },
              });
            },
            onFetching: () => {
              setSubmittingPlan(selectedRequestPlan);
              return () => setSubmittingPlan(null);
            },
          },
        });

        window.takuWaBillingCardForm = cardForm;
      } catch (requestError) {
        if (!cancelled) {
          setCardError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load Mercado Pago card form",
          );
        }
      }
    }

    void renderCardForm();

    return () => {
      cancelled = true;
      if (installmentsTimer !== null) {
        window.clearInterval(installmentsTimer);
      }
    };
  }, [cardRequest, plans, processCardPayment, sessionToken]);

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
            <button
              type="button"
              onClick={() => setCardRequest(latestRequest)}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-800"
            >
              Continue Mercado Pago subscription
            </button>
          </div>
        ) : null}

        {cardRequest && cardPlan ? (
          <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-xl shadow-slate-950/5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Mercado Pago
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  Pay {formatPrice(cardPlan)}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Submit the card payment to reactivate this subscription
                  period. Card data is handled by Mercado Pago.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCardRequest(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
              >
                Cancel
              </button>
            </div>

            {cardError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {cardError}
              </div>
            ) : null}

            <form id="taku-wa-billing-card-form" className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Card number
                <div
                  id="taku-wa-billing-card-number"
                  className="h-11 overflow-hidden rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-100"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Expiration
                  <div
                    id="taku-wa-billing-card-expiration"
                    className="h-11 overflow-hidden rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-100"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  CVV
                  <div
                    id="taku-wa-billing-card-security-code"
                    className="h-11 overflow-hidden rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-100"
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Name on card
                <input
                  id="taku-wa-billing-cardholder-name"
                  className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  type="text"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Email
                <input
                  id="taku-wa-billing-cardholder-email"
                  className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  type="email"
                  defaultValue={account?.email ?? ""}
                />
              </label>
              <div
                className={
                  installmentsReady ? "grid gap-3 sm:grid-cols-2" : "hidden"
                }
              >
                <label className="hidden">
                  <select
                    id="taku-wa-billing-card-issuer"
                    aria-label="Issuer"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Installments
                  <select
                    id="taku-wa-billing-card-installments"
                    className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={!cardReady || submittingPlan === cardRequest.toPlan}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submittingPlan === cardRequest.toPlan
                  ? "Processing..."
                  : `Pay ${formatPrice(cardPlan)}`}
              </button>
            </form>
          </section>
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
        </div>

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
