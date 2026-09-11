"use client";

import { useEffect, useState } from "react";

type PaidPlan = "starter" | "business" | "enterprise";

type CardPaymentResponse =
  | {
      ok: true;
      paymentIntent: {
        id: string;
        status: "paid" | "pending" | "attached";
        providerPaymentId: string | null;
        plan: PaidPlan;
      };
      paymentStatus?: string;
    }
  | {
      ok: false;
      error: string;
      paymentStatus?: string;
      paymentStatusDetail?: string | null;
      providerCauses?: Array<{
        code?: string;
        description?: string;
        data?: string;
      }>;
    };

type CardPaymentFormData = {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number;
  installments?: string | number;
  payer: { email: string };
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
    takuCardForm?: MercadoPagoCardForm;
  }
}

const mercadoPagoPublicKey =
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

const plans: Record<
  PaidPlan,
  { name: string; price: string; amount: number; description: string }
> = {
  starter: {
    name: "Starter",
    price: "$19/mes",
    amount: 19,
    description: "Para pequenos negocios con hasta 2 numeros y 5 agentes.",
  },
  business: {
    name: "Business",
    price: "$59/mes",
    amount: 59,
    description: "Para equipos con IA, API publica y reportes avanzados.",
  },
  enterprise: {
    name: "Enterprise",
    price: "$149/mes",
    amount: 149,
    description: "Para operaciones grandes con soporte prioritario.",
  },
};

function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://sdk.mercadopago.com/js/v2"]',
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar Mercado Pago.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Mercado Pago."));
    document.head.appendChild(script);
  });
}

function readPlan(): PaidPlan {
  if (typeof window === "undefined") return "starter";
  const value = new URLSearchParams(window.location.search).get("plan");
  return value === "business" || value === "enterprise" ? value : "starter";
}

function signupUrl(params: {
  plan: PaidPlan;
  paymentIntentId: string;
  email: string;
}) {
  const query = new URLSearchParams({
    plan: params.plan,
    paymentIntent: params.paymentIntentId,
    email: params.email,
  });
  return `/signup?${query.toString()}`;
}

export default function PaymentPage() {
  const [plan] = useState<PaidPlan>(() => readPlan());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [installmentsReady, setInstallmentsReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const planDetails = plans[plan];

  useEffect(() => {
    if (!mercadoPagoPublicKey) return;
    let cancelled = false;
    let installmentsTimer: number | null = null;

    function checkInstallmentsReady() {
      const select = document.getElementById(
        "taku-card-installments",
      ) as HTMLSelectElement | null;
      if (!select) return;
      setInstallmentsReady(
        Array.from(select.options).some((option) => option.value.trim()),
      );
    }

    async function processCardPayment(formData: CardPaymentFormData) {
      setIsSubmitting(true);
      setError(null);
      try {
        const response = await fetch("/api/billing/card-payment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan, ...formData }),
        });
        const payload = (await response.json()) as CardPaymentResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(
            !payload.ok
              ? [
                  payload.error,
                  payload.paymentStatusDetail
                    ? `Detalle: ${payload.paymentStatusDetail}`
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
              : "No se pudo procesar el pago.",
          );
        }
        setNotice("Pago aprobado. Completa tu cuenta TAKU.");
        window.location.href = signupUrl({
          plan,
          paymentIntentId: payload.paymentIntent.id,
          email: formData.payer.email,
        });
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo procesar el pago.",
        );
      } finally {
        setIsSubmitting(false);
      }
    }

    async function renderCardPaymentForm() {
      setCardReady(false);
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
            id: "taku-card-form",
            cardNumber: { id: "taku-card-number", placeholder: "Numero" },
            expirationDate: {
              id: "taku-card-expiration",
              placeholder: "MM/YY",
            },
            securityCode: { id: "taku-card-security-code", placeholder: "CVV" },
            cardholderName: {
              id: "taku-cardholder-name",
              placeholder: "Nombre",
            },
            issuer: { id: "taku-card-issuer", placeholder: "Banco" },
            installments: {
              id: "taku-card-installments",
              placeholder: "Meses",
            },
            cardholderEmail: {
              id: "taku-cardholder-email",
              placeholder: "Email",
            },
          },
          callbacks: {
            onFormMounted: (formError) => {
              if (cancelled) return;
              if (formError) {
                setError("No se pudo cargar el formulario de Mercado Pago.");
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
                payer: { email: data.cardholderEmail },
              });
            },
            onFetching: () => {
              setIsSubmitting(true);
              return () => setIsSubmitting(false);
            },
          },
        });
        window.takuCardForm = cardForm;
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar Mercado Pago.",
          );
        }
      }
    }

    void renderCardPaymentForm();
    return () => {
      cancelled = true;
      if (installmentsTimer !== null) window.clearInterval(installmentsTimer);
      window.takuCardForm = undefined;
    };
  }, [plan, planDetails.amount]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="flex items-center gap-3">
          <img src="/taku.png" alt="TAKU" className="h-10 w-10 rounded-lg" />
          <span className="text-sm font-bold tracking-[0.2em]">TAKU</span>
        </a>
        <a href="/#planes" className="text-sm font-semibold text-slate-700">
          Planes
        </a>
      </nav>
      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-16 pt-6 md:grid-cols-[0.9fr_1.1fr] md:px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Mercado Pago
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
            Activa TAKU {planDetails.name}.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            {planDetails.description} Al aprobarse el pago, completarás la
            creación de tu cuenta.
          </p>
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Total</p>
            <p className="mt-1 text-3xl font-semibold text-slate-950">
              {planDetails.price}
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          {!mercadoPagoPublicKey ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm font-medium text-slate-800">
              NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY no esta configurado.
            </div>
          ) : null}
          {notice ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm font-medium text-slate-800">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-sm font-medium text-slate-800">
              {error}
            </div>
          ) : null}
          {mercadoPagoPublicKey ? (
            <form id="taku-card-form" className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Numero de tarjeta
                <div
                  id="taku-card-number"
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Expiracion
                  <div
                    id="taku-card-expiration"
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  CVV
                  <div
                    id="taku-card-security-code"
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Nombre en tarjeta
                <input
                  id="taku-cardholder-name"
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Email
                <input
                  id="taku-cardholder-email"
                  type="email"
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Banco
                  <select
                    id="taku-card-issuer"
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Meses
                  <select
                    id="taku-card-installments"
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !cardReady || !installmentsReady}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting ? "Procesando..." : `Pagar ${planDetails.price}`}
              </button>
              {!cardReady || !installmentsReady ? (
                <p className="text-sm text-slate-500">
                  Cargando campos seguros de Mercado Pago.
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      </section>
    </main>
  );
}
