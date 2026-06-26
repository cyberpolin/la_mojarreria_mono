"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSessionHeaders, getStoredSession } from "../session";

type BusinessEntitlements = {
  plan: "paid" | "trial" | "suspended";
  canUseSchedules: boolean;
  botLimit: number | null;
  botsUsed: number;
};

type Business = {
  id: string;
  name: string;
  ownerName: string;
  status: "active" | "trial" | "suspended";
  entitlements?: BusinessEntitlements;
};

type PaymentResponse = {
  ok: true;
  business: Business;
  payment: {
    id: string;
    businessId: string;
    provider: "mock" | "mercadopago";
    providerPaymentId: string;
    providerPreferenceId: string | null;
    status: string;
    amount: number | null;
    currency: string | null;
    paidAt: string | null;
    rawProviderStatus: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

type PreferenceResponse = {
  ok: true;
  preference: {
    id: string;
    checkoutUrl: string;
  };
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

type MercadoPagoBrickController = {
  unmount: () => void;
};

type MercadoPagoBricksBuilder = {
  create: (
    type: "cardPayment",
    target: string,
    settings: {
      initialization: { amount: number };
      callbacks: {
        onReady: () => void;
        onSubmit: (formData: CardPaymentFormData) => Promise<void>;
        onError: (error: unknown) => void;
      };
    },
  ) => Promise<MercadoPagoBrickController>;
};

type MercadoPagoInstance = {
  bricks: () => MercadoPagoBricksBuilder;
};

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string },
    ) => MercadoPagoInstance;
    takuCardPaymentBrickController?: MercadoPagoBrickController;
  }
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_API_BASE_URL ?? "http://localhost:3010";
const apiKey = process.env.NEXT_PUBLIC_TAKU_API_KEY ?? "";
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

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
      ...getSessionHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    throw new Error(
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Request failed with ${response.status}`,
    );
  }

  return body as T;
}

function money(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export default function PaymentPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<PaymentResponse | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const query = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);
  const businessId = query?.get("businessId") ?? null;
  const paymentId = query?.get("payment_id") ?? query?.get("collection_id");
  const mercadoPagoReturn = query?.get("mp_return") ?? null;

  const selectedBusiness = useMemo(() => {
    const stored = getStoredSession();
    const sessionBusinessId = stored?.session.businessId ?? null;
    return (
      businesses.find((business) => business.id === businessId) ??
      businesses.find((business) => business.id === sessionBusinessId) ??
      businesses[0] ??
      null
    );
  }, [businessId, businesses]);

  useEffect(() => {
    async function loadBusinesses() {
      setLoading(true);
      setError(null);

      try {
        const body = await apiRequest<{ businesses: Business[] }>(
          "/v1/businesses",
        );
        setBusinesses(body.businesses);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to load business",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadBusinesses();
  }, []);

  useEffect(() => {
    if (!selectedBusiness || !paymentId || paid || confirming) return;

    async function confirmPayment() {
      if (!selectedBusiness || !paymentId) return;

      setConfirming(true);
      setError(null);

      try {
        const body = await apiRequest<PaymentResponse>(
          "/v1/billing/mercadopago/confirm",
          {
            method: "POST",
            body: JSON.stringify({
              businessId: selectedBusiness.id,
              paymentId,
            }),
          },
        );
        setPaid(body);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to confirm Mercado Pago payment",
        );
      } finally {
        setConfirming(false);
      }
    }

    void confirmPayment();
  }, [confirming, paid, paymentId, selectedBusiness]);

  useEffect(() => {
    if (!selectedBusiness || paid || !mercadoPagoPublicKey) {
      return;
    }

    let cancelled = false;

    async function renderCardPaymentBrick() {
      setCardReady(false);
      setCardError(null);

      try {
        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago) {
          return;
        }

        window.takuCardPaymentBrickController?.unmount();
        const mercadoPago = new window.MercadoPago(mercadoPagoPublicKey, {
          locale: "es-MX",
        });
        const bricksBuilder = mercadoPago.bricks();
        const controller = await bricksBuilder.create(
          "cardPayment",
          "taku-card-payment-brick",
          {
            initialization: {
              amount: 99,
            },
            callbacks: {
              onReady: () => {
                if (!cancelled) {
                  setCardReady(true);
                }
              },
              onSubmit: async (formData) => {
                if (!selectedBusiness) {
                  throw new Error("Business is required");
                }

                setSaving(true);
                setError(null);

                try {
                  const body = await apiRequest<PaymentResponse>(
                    "/v1/billing/mercadopago/card-payment",
                    {
                      method: "POST",
                      body: JSON.stringify({
                        businessId: selectedBusiness.id,
                        ...formData,
                      }),
                    },
                  );
                  setPaid(body);
                } catch (nextError) {
                  const message =
                    nextError instanceof Error
                      ? nextError.message
                      : "Unable to process card payment";
                  setError(message);
                } finally {
                  setSaving(false);
                }
              },
              onError: (brickError) => {
                console.error(brickError);
                setCardError("Mercado Pago card form could not be loaded.");
              },
            },
          },
        );

        window.takuCardPaymentBrickController = controller;
      } catch (nextError) {
        if (!cancelled) {
          setCardError(
            nextError instanceof Error
              ? nextError.message
              : "Could not load Mercado Pago card form",
          );
        }
      }
    }

    void renderCardPaymentBrick();

    return () => {
      cancelled = true;
      window.takuCardPaymentBrickController?.unmount();
      window.takuCardPaymentBrickController = undefined;
    };
  }, [paid, selectedBusiness]);

  async function startMercadoPagoCheckout() {
    if (!selectedBusiness) return;

    setSaving(true);
    setError(null);

    try {
      const body = await apiRequest<PreferenceResponse>(
        "/v1/billing/mercadopago/preference",
        {
          method: "POST",
          body: JSON.stringify({ businessId: selectedBusiness.id }),
        },
      );
      window.location.href = body.preference.checkoutUrl;
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to start Mercado Pago checkout",
      );
    } finally {
      setSaving(false);
    }
  }

  async function completeMockPayment() {
    if (!selectedBusiness) return;

    setSaving(true);
    setError(null);

    try {
      const body = await apiRequest<PaymentResponse>(
        "/v1/billing/mock-payment",
        {
          method: "POST",
          body: JSON.stringify({ businessId: selectedBusiness.id }),
        },
      );
      setPaid(body);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Payment failed",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              TAKU Billing
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">
              Payment
            </h1>
          </div>
          <Link
            href="/admin"
            className="flex min-h-10 items-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
          >
            Admin
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 md:grid-cols-[1fr_360px] md:px-6">
        <section className="rounded-lg border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-4">
            <h2 className="text-lg font-semibold text-slate-50">Checkout</h2>
          </div>
          <div className="p-4">
            {error ? (
              <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100">
                {error}
              </div>
            ) : null}

            {mercadoPagoReturn && !paid && !error ? (
              <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                {confirming
                  ? "Confirming Mercado Pago payment..."
                  : "Waiting for Mercado Pago confirmation."}
              </div>
            ) : null}

            {paid ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-semibold text-slate-50">
                    Payment accepted
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {paid.payment.provider === "mercadopago"
                      ? "Mercado Pago"
                      : "Mock"}{" "}
                    payment {paid.payment.providerPaymentId} activated{" "}
                    {paid.business.name}.
                  </p>
                </div>
                <Link
                  href="/admin"
                  className="inline-flex min-h-11 items-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                >
                  Return to admin
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm font-semibold text-slate-50">
                    Pay by card
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Card fields are rendered by Mercado Pago. TAKU receives the
                    tokenized payment result and activates the account when the
                    charge is approved.
                  </p>
                </div>
                {!mercadoPagoPublicKey ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                    Mercado Pago public key is not configured.
                  </div>
                ) : null}
                {cardError ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100">
                    {cardError}
                  </div>
                ) : null}
                {mercadoPagoPublicKey ? (
                  <div className="rounded-lg border border-slate-800 bg-white p-3 text-slate-950">
                    {!cardReady ? (
                      <div className="p-4 text-sm text-slate-600">
                        Loading secure card form...
                      </div>
                    ) : null}
                    <div id="taku-card-payment-brick" />
                  </div>
                ) : null}
                {process.env.NODE_ENV === "development" ? (
                  <button
                    type="button"
                    onClick={() => void completeMockPayment()}
                    disabled={loading || saving || !selectedBusiness}
                    className="min-h-11 w-full rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Dev mock payment
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Account
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-50">
              {selectedBusiness?.name ?? "Loading..."}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {selectedBusiness?.ownerName ?? ""}
            </p>
          </section>
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              TAKU Paid
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {money(9900, "MXN")}
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Unlimited bots</p>
              <p>Phone schedules</p>
              <p>Active WhatsApp automation</p>
            </div>
          </section>
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs leading-5 text-slate-400">
            Mercado Pago renders and tokenizes card details. TAKU does not store
            card numbers or security codes.
          </section>
        </aside>
      </div>
    </main>
  );
}
