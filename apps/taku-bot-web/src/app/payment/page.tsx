"use client";

import { useEffect, useState } from "react";

type BotPlan = "on_demand" | "high_usage";

type CardPaymentResponse =
  | {
      ok: true;
      paymentIntent: {
        id: string;
        status: "paid" | "pending";
        providerPaymentId: string | null;
        toPlan: BotPlan;
      };
      billingAccount?: {
        clientId: string;
        tier: string;
        prepaidBalanceUsd: number;
      };
      clientToken?: string | null;
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
        code?: string;
        description?: string;
        data?: string;
      }>;
      paymentIntent?: {
        id: string;
        status: "paid" | "pending";
        providerPaymentId: string | null;
        toPlan: BotPlan;
      };
    };

type CardPaymentFormData = {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number;
  installments?: string | number;
  payer: {
    email: string;
  };
};

type MercadoPagoCardFormData = {
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments?: string;
  cardholderEmail: string;
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
    takuBotCardForm?: MercadoPagoCardForm;
  }
}

const mercadoPagoPublicKey =
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

const plans: Record<
  BotPlan,
  { name: string; price: string; amount: number; description: string }
> = {
  on_demand: {
    name: "On demand",
    price: "$5 minimum",
    amount: 5,
    description: "Prepaid bot usage for production assistants.",
  },
  high_usage: {
    name: "High usage",
    price: "$20 minimum",
    amount: 20,
    description: "Prepaid bot usage with a 10% TAKU charge discount.",
  },
};

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

function readPlan(): BotPlan {
  if (typeof window === "undefined") return "on_demand";
  const value = new URLSearchParams(window.location.search).get("plan");
  if (value === "platform") return "high_usage";
  if (value === "business") return "on_demand";
  return value === "high_usage" ? "high_usage" : "on_demand";
}

function paymentEmailStorageKey(paymentIntentId: string) {
  return `TAKU_BOT_PAYMENT_EMAIL_${paymentIntentId}`;
}

function accountNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "Bot User";
  return (
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Bot User"
  );
}

function accountIdFromEmail(email: string): string {
  return `bot_account_${window
    .btoa(email.trim().toLowerCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 16)}`;
}

function createPaidLocalSession(params: {
  paymentIntentId: string;
  email: string;
  plan: BotPlan;
  clientId: string;
  clientToken?: string | null;
}) {
  const name = accountNameFromEmail(params.email);
  window.localStorage.setItem(
    "TAKU_BOT_SESSION",
    JSON.stringify({
      account: {
        id: params.clientId,
        clientToken: params.clientToken,
        name,
        email: params.email,
        projectName: `${name} Workspace`,
        plan: params.plan,
        paymentIntentId: params.paymentIntentId,
        role: "client_user",
      },
      bot: {
        id: `bot_${Date.now()}`,
        name: "Customer assistant",
      },
      createdAt: new Date().toISOString(),
    }),
  );
  window.localStorage.removeItem(
    paymentEmailStorageKey(params.paymentIntentId),
  );
  window.location.href = "/admin";
}

export default function PaymentPage() {
  const [plan] = useState<BotPlan>(() => readPlan());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [installmentsReady, setInstallmentsReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const planDetails = plans[plan];

  useEffect(() => {
    if (!mercadoPagoPublicKey) {
      return;
    }

    let cancelled = false;
    let installmentsTimer: number | null = null;

    function checkInstallmentsReady() {
      const select = document.getElementById(
        "taku-bot-card-installments",
      ) as HTMLSelectElement | null;
      if (!select) return;

      const hasRealOption = Array.from(select.options).some(
        (option) =>
          option.value.trim().length > 0 &&
          option.textContent?.trim().length !== 0,
      );
      setInstallmentsReady(hasRealOption);
    }

    async function processCardPayment(formData: CardPaymentFormData) {
      setIsSubmitting(true);
      setError(null);

      try {
        const clientId = accountIdFromEmail(formData.payer.email);
        const response = await fetch("/api/billing/card-payment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            plan,
            client_id: clientId,
            ...formData,
          }),
        });
        const payload = (await response.json()) as CardPaymentResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(
            !payload.ok
              ? [
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
                  .join(" - ")
              : "Could not process card payment",
          );
        }

        window.localStorage.setItem(
          paymentEmailStorageKey(payload.paymentIntent.id),
          formData.payer.email,
        );
        setNotice("Payment approved. Opening your bot console.");
        createPaidLocalSession({
          paymentIntentId: payload.paymentIntent.id,
          email: formData.payer.email,
          plan,
          clientId,
          clientToken: payload.clientToken ?? null,
        });
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not process card payment",
        );
      } finally {
        setIsSubmitting(false);
      }
    }

    async function renderCardPaymentForm() {
      setCardReady(false);
      setCardError(null);
      setInstallmentsReady(false);

      try {
        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago) return;

        const mercadoPago = new window.MercadoPago(mercadoPagoPublicKey, {
          locale: "es-MX",
        });
        let cardForm: MercadoPagoCardForm | null = null;
        cardForm = mercadoPago.cardForm({
          amount: String(planDetails.amount),
          iframe: true,
          form: {
            id: "taku-bot-card-form",
            cardNumber: {
              id: "taku-bot-card-number",
              placeholder: "Card number",
            },
            expirationDate: {
              id: "taku-bot-card-expiration",
              placeholder: "MM/YY",
            },
            securityCode: {
              id: "taku-bot-card-security-code",
              placeholder: "CVV",
            },
            cardholderName: {
              id: "taku-bot-cardholder-name",
              placeholder: "Name on card",
            },
            issuer: {
              id: "taku-bot-card-issuer",
              placeholder: "Issuer",
            },
            installments: {
              id: "taku-bot-card-installments",
              placeholder: "Installments",
            },
            cardholderEmail: {
              id: "taku-bot-cardholder-email",
              placeholder: "Email",
            },
          },
          callbacks: {
            onFormMounted: (formError) => {
              if (cancelled) return;
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
              if (!cardForm) return;

              const data = cardForm.getCardFormData();
              void processCardPayment({
                token: data.token,
                payment_method_id: data.paymentMethodId,
                issuer_id: data.issuerId,
                installments: data.installments || "1",
                payer: {
                  email: data.cardholderEmail,
                },
              });
            },
            onFetching: () => {
              setIsSubmitting(true);
              return () => setIsSubmitting(false);
            },
          },
        });

        window.takuBotCardForm = cardForm;
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

    void renderCardPaymentForm();

    return () => {
      cancelled = true;
      if (installmentsTimer !== null) {
        window.clearInterval(installmentsTimer);
      }
      window.takuBotCardForm = undefined;
    };
  }, [plan, planDetails.amount]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU BOT
        </a>
        <a
          href="/#pricing"
          className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
        >
          Pricing
        </a>
      </nav>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-16 pt-6 md:grid-cols-[0.9fr_1.1fr] md:px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Mercado Pago
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
            Add {planDetails.price} to {planDetails.name}.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            TAKU Bot uses Mercado Pago to add prepaid balance. The approved
            payment activates the selected usage tier and opens your bot
            console.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          {!mercadoPagoPublicKey ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
              NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY is not configured.
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              {notice}
            </div>
          ) : null}

          {(error ?? cardError) ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error ?? cardError}
            </div>
          ) : null}

          {mercadoPagoPublicKey ? (
            <form id="taku-bot-card-form" className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <label
                  htmlFor="taku-bot-card-number"
                  className="text-sm font-medium text-slate-700"
                >
                  Card number
                </label>
                <div
                  id="taku-bot-card-number"
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-3"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label
                    htmlFor="taku-bot-card-expiration"
                    className="text-sm font-medium text-slate-700"
                  >
                    Expiration
                  </label>
                  <div
                    id="taku-bot-card-expiration"
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-3"
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    htmlFor="taku-bot-card-security-code"
                    className="text-sm font-medium text-slate-700"
                  >
                    CVV
                  </label>
                  <div
                    id="taku-bot-card-security-code"
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-3"
                  />
                </div>
              </div>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Name on card
                <input
                  id="taku-bot-cardholder-name"
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Email
                <input
                  id="taku-bot-cardholder-email"
                  type="email"
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Issuer
                  <select
                    id="taku-bot-card-issuer"
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Installments
                  <select
                    id="taku-bot-card-installments"
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !cardReady || !installmentsReady}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting
                  ? "Processing payment..."
                  : `Pay ${planDetails.price}`}
              </button>
              {!cardReady || !installmentsReady ? (
                <p className="text-sm text-slate-500">
                  Loading Mercado Pago secure card fields.
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      </section>
    </main>
  );
}
