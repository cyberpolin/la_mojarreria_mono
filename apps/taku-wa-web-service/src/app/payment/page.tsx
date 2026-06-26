"use client";

import { useEffect, useState } from "react";

type PaidPlan = "basic" | "developer" | "platform";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_API_BASE_URL ?? "http://localhost:3001";

const paidPlans: Record<
  PaidPlan,
  { name: string; price: string; amount: number; description: string }
> = {
  basic: {
    name: "Basic",
    price: "$9/mo",
    amount: 9,
    description: "For testing and prototypes.",
  },
  developer: {
    name: "Developer",
    price: "$29/mo",
    amount: 29,
    description: "Build WhatsApp into your own application.",
  },
  platform: {
    name: "Platform",
    price: "$99/mo",
    amount: 99,
    description: "For SaaS teams that need tenant-aware WhatsApp transport.",
  },
};

type CheckoutResponse =
  | {
      ok: true;
      checkoutUrl: string;
      returnUrlConfigured?: boolean;
      returnUrlWarning?: string | null;
      paymentIntent: {
        id: string;
        status: "pending" | "paid" | "attached" | "cancelled";
      };
    }
  | { ok: false; error: string };

type CardPaymentResponse =
  | {
      ok: true;
      paymentIntent: {
        id: string;
        status: "pending" | "paid" | "attached" | "cancelled";
      };
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
      paymentIntent?: {
        id: string;
        status: "pending" | "paid" | "attached" | "cancelled";
      };
    };

type ConfirmResponse =
  | {
      ok: true;
      paymentIntent: {
        id: string;
        status: "pending" | "paid" | "attached" | "cancelled";
      };
      paymentStatus?: string;
    }
  | { ok: false; error: string };

type SignupResult =
  | {
      ok: true;
      account: {
        id: string;
        name: string;
        email: string;
        projectName: string;
        plan: string;
        connectionIds: string[];
      };
      connectionId: string;
      sessionToken: string;
      sessionExpiresAt: string;
    }
  | { ok: false; error: string };

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
    takuWaCardForm?: MercadoPagoCardForm;
  }
}

const mercadoPagoPublicKey =
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";
const stopPaymentRedirects = false;

function debugPaymentRedirect(
  targetUrl: string,
  context: Record<string, unknown>,
) {
  if (!stopPaymentRedirects) {
    return false;
  }

  console.info("[wa web payment] blocked redirect", {
    targetUrl,
    ...context,
  });
  return true;
}

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

function readPlan(): PaidPlan {
  if (typeof window === "undefined") {
    return "basic";
  }

  const plan = new URLSearchParams(window.location.search).get("plan");
  return plan === "developer" || plan === "platform" || plan === "basic"
    ? plan
    : "basic";
}

function paymentIntentStorageKey(plan: PaidPlan): string {
  return `TAKU_WA_PAYMENT_INTENT_${plan}`;
}

function paymentEmailStorageKey(paymentIntentId: string): string {
  return `TAKU_WA_PAYMENT_EMAIL_${paymentIntentId}`;
}

function readPaymentEmail(paymentIntentId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(
    paymentEmailStorageKey(paymentIntentId),
  );
  return value && value.length > 0 ? value : null;
}

function randomPassword(): string {
  const bytes = new Uint8Array(18);
  window.crypto.getRandomValues(bytes);
  return `Taku-${Array.from(bytes, (byte) =>
    byte.toString(36).padStart(2, "0"),
  ).join("")}`;
}

function accountNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "Developer";
  return (
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Developer"
  );
}

function readStoredPaymentIntent(plan: PaidPlan): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(paymentIntentStorageKey(plan));
}

function readPaymentIntentFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const paymentIntent = new URLSearchParams(window.location.search).get(
    "paymentIntent",
  );
  return paymentIntent && paymentIntent.length > 0 ? paymentIntent : null;
}

function readPaymentResultFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const payment = new URLSearchParams(window.location.search).get("payment");
  return payment && payment.length > 0 ? payment : null;
}

export default function PaymentPage() {
  const [plan] = useState<PaidPlan>(() => readPlan());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [installmentsReady, setInstallmentsReady] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(
    () => readPaymentIntentFromUrl() ?? readStoredPaymentIntent(readPlan()),
  );
  const [notice, setNotice] = useState<string | null>(() => {
    const paymentResult = readPaymentResultFromUrl();
    if (paymentResult === "success") {
      return "Payment received by Mercado Pago. Confirming it with TAKU...";
    }
    if (paymentResult === "pending") {
      return "Mercado Pago marked this payment as pending. TAKU will keep checking.";
    }
    if (paymentResult === "failure") {
      return "Mercado Pago could not complete the payment. Try again or use another payment method.";
    }
    return null;
  });
  const [error, setError] = useState<string | null>(null);
  const planDetails = paidPlans[plan];

  function clearPaymentIntent() {
    console.info("[wa web payment] clearing payment intent", {
      plan,
      paymentIntentId,
    });
    window.localStorage.removeItem(paymentIntentStorageKey(plan));
    setPaymentIntentId(null);
    setNotice(null);
    setError(null);
  }

  async function createPaidAccount(params: {
    paymentIntentId: string;
    email: string;
  }) {
    const name = accountNameFromEmail(params.email);
    const response = await fetch(`${apiBaseUrl}/v1/public/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email: params.email,
        projectName: `${name} Project`,
        password: randomPassword(),
        paidPaymentIntentId: params.paymentIntentId,
      }),
    });
    const payload = (await response.json()) as SignupResult;

    if (!response.ok || !payload.ok) {
      throw new Error(!payload.ok ? payload.error : "Could not create account");
    }

    window.localStorage.setItem(
      "TAKU_WA_SIGNUP_RESULT",
      JSON.stringify({
        account: payload.account,
        connectionId: payload.connectionId,
        sessionToken: payload.sessionToken,
        sessionExpiresAt: payload.sessionExpiresAt,
        createdAt: new Date().toISOString(),
      }),
    );
    window.localStorage.removeItem(
      paymentEmailStorageKey(params.paymentIntentId),
    );
    window.location.href = "/admin";
  }

  async function startPayment() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/v1/public/billing/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json()) as CheckoutResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(
          !payload.ok ? payload.error : "Could not start payment",
        );
      }

      setPaymentIntentId(payload.paymentIntent.id);
      window.localStorage.setItem(
        paymentIntentStorageKey(plan),
        payload.paymentIntent.id,
      );
      if (payload.returnUrlConfigured) {
        if (
          debugPaymentRedirect(payload.checkoutUrl, {
            source: "checkout-return-url",
            plan,
            paymentIntentId: payload.paymentIntent.id,
          })
        ) {
          setNotice("Debug mode blocked the Mercado Pago checkout redirect.");
          return;
        }
        window.location.href = payload.checkoutUrl;
        return;
      }

      if (
        debugPaymentRedirect(payload.checkoutUrl, {
          source: "checkout-window-open",
          plan,
          paymentIntentId: payload.paymentIntent.id,
        })
      ) {
        setNotice("Debug mode blocked the Mercado Pago checkout window.");
        return;
      }
      const checkoutWindow = window.open(payload.checkoutUrl, "_blank");
      if (!checkoutWindow) {
        if (
          debugPaymentRedirect(payload.checkoutUrl, {
            source: "checkout-popup-fallback",
            plan,
            paymentIntentId: payload.paymentIntent.id,
          })
        ) {
          setNotice("Debug mode blocked the Mercado Pago checkout fallback.");
          return;
        }
        window.location.href = payload.checkoutUrl;
        return;
      }

      checkoutWindow.opener = null;
      setNotice(
        "Mercado Pago opened in a new tab. Complete payment, then return here.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not start payment",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmPayment(options?: { quiet?: boolean }) {
    if (!paymentIntentId) {
      return;
    }

    if (!options?.quiet) {
      setIsConfirming(true);
      setError(null);
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/v1/public/billing/intents/${paymentIntentId}/confirm`,
        { method: "POST" },
      );
      const payload = (await response.json()) as ConfirmResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(
          !payload.ok ? payload.error : "Could not confirm payment",
        );
      }

      if (payload.paymentIntent.status !== "paid") {
        if (!options?.quiet) {
          setNotice(
            payload.paymentStatus
              ? `Payment status is ${payload.paymentStatus}. Try again in a moment.`
              : "Payment is not confirmed yet. Try again in a moment.",
          );
        }
        return;
      }

      window.localStorage.removeItem(paymentIntentStorageKey(plan));
      const paymentEmail = readPaymentEmail(paymentIntentId);
      if (!paymentEmail) {
        throw new Error("Payment email is missing. Start the payment again.");
      }
      await createPaidAccount({
        paymentIntentId,
        email: paymentEmail,
      });
    } catch (requestError) {
      if (!options?.quiet) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not confirm payment",
        );
      }
    } finally {
      if (!options?.quiet) {
        setIsConfirming(false);
      }
    }
  }

  useEffect(() => {
    if (paymentIntentId || !mercadoPagoPublicKey) {
      return;
    }

    let cancelled = false;
    let installmentsTimer: number | null = null;

    function checkInstallmentsReady() {
      const select = document.getElementById(
        "taku-wa-card-installments",
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

    async function processCardPayment(formData: CardPaymentFormData) {
      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiBaseUrl}/v1/public/billing/card-payment`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              plan,
              ...formData,
            }),
          },
        );
        const payload = (await response.json()) as CardPaymentResponse;
        if (!response.ok || !payload.ok) {
          if (!payload.ok) {
            console.error("[wa web payment] card payment failed", {
              error: payload.error,
              paymentStatus: payload.paymentStatus,
              paymentStatusDetail: payload.paymentStatusDetail,
              providerStatus: payload.providerStatus,
              providerError: payload.providerError,
              providerCauses: payload.providerCauses,
            });
          }
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

        setPaymentIntentId(payload.paymentIntent.id);
        window.localStorage.setItem(
          paymentIntentStorageKey(plan),
          payload.paymentIntent.id,
        );
        window.localStorage.setItem(
          paymentEmailStorageKey(payload.paymentIntent.id),
          formData.payer.email,
        );

        if (payload.paymentIntent.status === "paid") {
          window.localStorage.removeItem(paymentIntentStorageKey(plan));
          await createPaidAccount({
            paymentIntentId: payload.paymentIntent.id,
            email: formData.payer.email,
          });
          return;
        }

        setNotice("Payment is being reviewed. TAKU will keep checking.");
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
        if (cancelled || !window.MercadoPago) {
          return;
        }

        const mercadoPago = new window.MercadoPago(mercadoPagoPublicKey, {
          locale: "es-MX",
        });
        let cardForm: MercadoPagoCardForm | null = null;
        cardForm = mercadoPago.cardForm({
          amount: String(planDetails.amount),
          iframe: true,
          form: {
            id: "taku-wa-card-form",
            cardNumber: {
              id: "taku-wa-card-number",
              placeholder: "Card number",
            },
            expirationDate: {
              id: "taku-wa-card-expiration",
              placeholder: "MM/YY",
            },
            securityCode: {
              id: "taku-wa-card-security-code",
              placeholder: "CVV",
            },
            cardholderName: {
              id: "taku-wa-cardholder-name",
              placeholder: "Name on card",
            },
            issuer: {
              id: "taku-wa-card-issuer",
              placeholder: "Issuer",
            },
            installments: {
              id: "taku-wa-card-installments",
              placeholder: "Installments",
            },
            cardholderEmail: {
              id: "taku-wa-cardholder-email",
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
              console.info("[wa web payment] submitting card payment", {
                plan,
                paymentMethodId: data.paymentMethodId,
                issuerId: data.issuerId,
                installments: data.installments,
                payerEmail: data.cardholderEmail,
                hasToken: Boolean(data.token),
                hasIdentification: Boolean(
                  data.identificationType && data.identificationNumber,
                ),
              });
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
              setIsSubmitting(true);
              return () => setIsSubmitting(false);
            },
          },
        });

        window.takuWaCardForm = cardForm;
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
      window.takuWaCardForm = undefined;
    };
  }, [paymentIntentId, plan, planDetails.amount]);

  useEffect(() => {
    if (!paymentIntentId) {
      return;
    }

    console.info("[wa web payment] polling existing payment intent", {
      plan,
      paymentIntentId,
    });
    setNotice(
      "Waiting for Mercado Pago confirmation. Keep this tab open while TAKU checks the payment.",
    );
    void confirmPayment({ quiet: true });
    const timer = window.setInterval(() => {
      void confirmPayment({ quiet: true });
    }, 3000);

    return () => window.clearInterval(timer);
    // confirmPayment uses current component state and redirects once paid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentIntentId]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU
        </a>
        <a
          href="/#pricing"
          className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
        >
          Change plan
        </a>
      </nav>

      <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 pb-16 pt-10 md:grid-cols-[0.9fr_1.1fr] md:px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Payment first
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
            Pay for {planDetails.name}, then create your account.
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-600">
            Mercado Pago handles the charge. After payment, TAKU asks for your
            account details and opens phone pairing.
          </p>
        </div>

        <div className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5 md:p-6">
          <p className="text-sm font-semibold text-slate-500">Selected plan</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">
            {planDetails.name}
          </h2>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">
            {planDetails.price}
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {planDetails.description}
          </p>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              {notice}
            </div>
          ) : null}

          {!paymentIntentId ? (
            <div className="mt-6">
              {!mercadoPagoPublicKey ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                  Mercado Pago public key is not configured.
                </div>
              ) : null}
              {cardError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                  {cardError}
                </div>
              ) : null}
              {mercadoPagoPublicKey ? (
                <form
                  id="taku-wa-card-form"
                  className="rounded-xl border border-slate-200 bg-white p-4 text-slate-950"
                >
                  {!cardReady ? (
                    <div className="p-4 text-sm text-slate-600">
                      Loading secure card form...
                    </div>
                  ) : null}
                  <div className="grid gap-3">
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      Card number
                      <div
                        id="taku-wa-card-number"
                        className="h-11 overflow-hidden rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-100"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm font-medium text-slate-700">
                        Expiration
                        <div
                          id="taku-wa-card-expiration"
                          className="h-11 overflow-hidden rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-100"
                        />
                      </label>
                      <label className="grid gap-1 text-sm font-medium text-slate-700">
                        CVV
                        <div
                          id="taku-wa-card-security-code"
                          className="h-11 overflow-hidden rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-100"
                        />
                      </label>
                    </div>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      Name on card
                      <input
                        id="taku-wa-cardholder-name"
                        className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                        type="text"
                      />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      Email
                      <input
                        id="taku-wa-cardholder-email"
                        className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                        type="email"
                      />
                    </label>
                    <div
                      className={
                        installmentsReady
                          ? "grid gap-3 sm:grid-cols-2"
                          : "hidden"
                      }
                    >
                      <label className="hidden">
                        <select id="taku-wa-card-issuer" aria-label="Issuer" />
                      </label>
                      <label className="grid gap-1 text-sm font-medium text-slate-700">
                        Installments
                        <select
                          id="taku-wa-card-installments"
                          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={!cardReady || isSubmitting}
                      className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isSubmitting
                        ? "Processing..."
                        : `Pay ${planDetails.price}`}
                    </button>
                  </div>
                </form>
              ) : null}
              {isSubmitting ? (
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Processing payment...
                </p>
              ) : null}
            </div>
          ) : null}
          {paymentIntentId ? (
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => void confirmPayment()}
                disabled={isConfirming}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-300 px-6 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              >
                {isConfirming
                  ? "Checking payment..."
                  : "Continue to account setup"}
              </button>
              <button
                type="button"
                onClick={clearPaymentIntent}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-red-200 px-6 text-sm font-semibold text-red-700 hover:border-red-400"
              >
                Start over with card payment
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
