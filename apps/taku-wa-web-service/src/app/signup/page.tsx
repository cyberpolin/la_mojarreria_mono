"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";

type PaidPlan = "basic" | "developer" | "platform";

const paidPlans: Record<
  PaidPlan,
  { name: string; price: string; description: string }
> = {
  basic: {
    name: "Basic",
    price: "$9/mo",
    description: "For testing and prototypes.",
  },
  developer: {
    name: "Developer",
    price: "$29/mo",
    description: "Build WhatsApp into your own application.",
  },
  platform: {
    name: "Platform",
    price: "$99/mo",
    description: "For SaaS teams that need tenant-aware WhatsApp transport.",
  },
};

type SignupResult = {
  ok: true;
  account: {
    id: string;
    name: string;
    email: string;
    projectName: string;
    plan: string;
    connectionIds: string[];
  };
  apiKey: string;
  sessionToken: string;
  sessionExpiresAt: string;
  entitlements: {
    connectionLimit: number | null;
    dailyMessageLimit: number | null;
    webhooksEnabled: boolean;
  };
  usage: {
    date: string;
    messagesSent: number;
  };
  connectionId: string;
  qrImage: string | null;
  pairingError: string | null;
};

type SignupError = {
  ok: false;
  error: string;
  issues?: Record<string, string[]>;
};

type QrResponse = {
  ok: boolean;
  qrImage: string | null;
  error?: string;
};

type PaymentIntentResponse =
  | {
      ok: true;
      paymentIntent: {
        id: string;
        status: "pending" | "paid" | "attached" | "cancelled";
        toPlan: PaidPlan;
      };
    }
  | { ok: false; error: string };

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_API_BASE_URL ?? "http://localhost:3001";

function readSelectedPlan(): PaidPlan | null {
  if (typeof window === "undefined") {
    return null;
  }

  const plan = new URLSearchParams(window.location.search).get("plan");
  return plan === "basic" || plan === "developer" || plan === "platform"
    ? plan
    : null;
}

function readPaymentIntentId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(
    "paymentIntent",
  );
  return value && value.length > 0 ? value : null;
}

function readPaymentEmail(paymentIntentId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(
    `TAKU_WA_PAYMENT_EMAIL_${paymentIntentId}`,
  );
  return value && value.length > 0 ? value : null;
}

function Field(params: {
  id: string;
  label: string;
  type?: string;
  value: string;
  autoComplete?: string;
  error?: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {params.label}
      <input
        id={params.id}
        type={params.type ?? "text"}
        value={params.value}
        autoComplete={params.autoComplete}
        onChange={(event) => params.onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
      />
      {params.error ? (
        <span className="text-xs font-medium text-red-600">
          {params.error.join(", ")}
        </span>
      ) : null}
    </label>
  );
}

export default function SignupPage() {
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentIntentStatus, setPaymentIntentStatus] = useState<
    "pending" | "paid" | "attached" | "cancelled" | null
  >(null);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [result, setResult] = useState<SignupResult | null>(null);
  const [error, setError] = useState<SignupError | null>(null);

  const connectionId = result?.connectionId ?? "wa_connection_id";
  const selectedPlanDetails = selectedPlan ? paidPlans[selectedPlan] : null;
  const requiresPaymentFirst = Boolean(selectedPlan && !paymentIntentId);
  const waitsForPaymentConfirmation = Boolean(
    selectedPlan && paymentIntentId && paymentIntentStatus !== "paid",
  );
  const curlExample = useMemo(
    () => `curl -X POST ${apiBaseUrl}/v1/account/connections/${connectionId}/messages \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${result?.apiKey ?? "$TAKU_WA_API_KEY"}" \\
  -d '{
    "to": "5219931234567",
    "text": "Your order is ready."
  }'`,
    [connectionId, result?.apiKey],
  );

  useEffect(() => {
    const nextSelectedPlan = readSelectedPlan();
    const nextPaymentIntentId = readPaymentIntentId();
    setSelectedPlan(nextSelectedPlan);
    setPaymentIntentId(nextPaymentIntentId);
    if (nextPaymentIntentId) {
      setEmail(
        (currentEmail) =>
          currentEmail || readPaymentEmail(nextPaymentIntentId) || "",
      );
    }
    setPaymentIntentStatus(nextPaymentIntentId ? "pending" : null);
    setPaymentStatus(
      nextPaymentIntentId
        ? "Payment received. Add your account details to start onboarding."
        : null,
    );
  }, []);

  useEffect(() => {
    if (!paymentIntentId) {
      return;
    }

    let cancelled = false;
    async function checkPaymentIntent() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/v1/public/billing/intents/${paymentIntentId}`,
        );
        const payload = (await response.json()) as PaymentIntentResponse;
        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.ok) {
          setPaymentIntentStatus("pending");
          setPaymentStatus("Payment is not confirmed yet.");
          return;
        }

        setPaymentIntentStatus(payload.paymentIntent.status);
        if (payload.paymentIntent.status === "paid") {
          setPaymentStatus(
            "Payment confirmed. Add your account details to start onboarding.",
          );
        } else if (payload.paymentIntent.status === "attached") {
          setPaymentStatus("Payment was already used for an account.");
        } else {
          setPaymentStatus("Payment is still pending. Try again in a moment.");
        }
      } catch {
        if (!cancelled) {
          setPaymentStatus("Payment is not confirmed yet.");
        }
      }
    }

    void checkPaymentIntent();
    const timer = window.setInterval(() => void checkPaymentIntent(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [paymentIntentId]);

  async function refreshQr(params: {
    apiKey: string;
    connectionId: string;
    attempts?: number;
  }) {
    setIsFetchingQr(true);
    setQrStatus("Waiting for WhatsApp QR...");

    try {
      const attempts = params.attempts ?? 1;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const response = await fetch(
          `${apiBaseUrl}/v1/account/connections/${params.connectionId}/qr`,
          { headers: { "x-api-key": params.apiKey } },
        );
        const payload = (await response.json()) as QrResponse;

        if (!response.ok || !payload.ok) {
          setQrStatus(payload.error ?? "Could not fetch the QR yet.");
          return;
        }

        if (payload.qrImage) {
          setResult((current) =>
            current
              ? {
                  ...current,
                  qrImage: payload.qrImage,
                  pairingError: null,
                }
              : current,
          );
          setQrStatus("QR ready. Scan it from WhatsApp linked devices.");
          return;
        }

        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      setQrStatus("QR is not ready yet. Try refreshing it in a moment.");
    } catch (requestError) {
      setQrStatus(
        requestError instanceof Error
          ? requestError.message
          : "Could not fetch the QR.",
      );
    } finally {
      setIsFetchingQr(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    setQrStatus(null);
    setPaymentStatus(null);

    try {
      const signupPayload = {
        name,
        email,
        projectName,
        password,
        ...(paymentIntentId ? { paidPaymentIntentId: paymentIntentId } : {}),
      };
      const response = await fetch(`${apiBaseUrl}/v1/public/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(signupPayload),
      });
      const payload = (await response.json()) as SignupResult | SignupError;

      if (!response.ok || !payload.ok) {
        setError(payload as SignupError);
        return;
      }

      window.localStorage.setItem(
        "TAKU_WA_SIGNUP_RESULT",
        JSON.stringify({
          account: payload.account,
          connectionId: payload.connectionId,
          apiKey: payload.apiKey,
          sessionToken: payload.sessionToken,
          sessionExpiresAt: payload.sessionExpiresAt,
          createdAt: new Date().toISOString(),
        }),
      );

      if (selectedPlan) {
        window.location.href = "/admin";
        return;
      }

      setResult(payload);

      if (!payload.qrImage) {
        void refreshQr({
          apiKey: payload.apiKey,
          connectionId: payload.connectionId,
          attempts: 10,
        });
      } else {
        setQrStatus("QR ready. Scan it from WhatsApp linked devices.");
      }
    } catch (requestError) {
      setError({
        ok: false,
        error:
          requestError instanceof Error
            ? requestError.message
            : "Failed to create account",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU
        </a>
        <a
          href="/status"
          className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
        >
          Check status
        </a>
      </nav>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-16 pt-6 md:grid-cols-[0.9fr_1.1fr] md:px-6">
        <div className="self-start">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {selectedPlanDetails
              ? "Payment, then onboarding"
              : "Free developer account"}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
            {selectedPlanDetails
              ? `Start ${selectedPlanDetails.name} for ${selectedPlanDetails.price}.`
              : "Pair your first WhatsApp phone today."}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            {selectedPlanDetails
              ? "Complete payment in Mercado Pago first. Then add your account details and pair your WhatsApp phone from the admin onboarding screen."
              : "Create a standalone TAKU WA account, scan the QR, and send up to 100 messages per day on the free tier."}
          </p>
          <a
            href="/#pricing"
            className="mt-5 inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Show all plans
          </a>
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-emerald-900">
              {selectedPlanDetails
                ? `${selectedPlanDetails.name} includes`
                : "Starter includes"}
            </p>
            <ul className="mt-4 grid gap-3 text-sm text-emerald-900">
              {selectedPlan === "developer" ? (
                <>
                  <li>Up to 10 WhatsApp connections</li>
                  <li>Conversation history</li>
                  <li>Auto reconnect</li>
                </>
              ) : selectedPlan === "platform" ? (
                <>
                  <li>Up to 50 WhatsApp connections</li>
                  <li>Multi-tenant management</li>
                  <li>Operational support</li>
                </>
              ) : selectedPlan === "basic" ? (
                <>
                  <li>1 WhatsApp connection</li>
                  <li>Send and receive messages</li>
                  <li>Webhooks</li>
                </>
              ) : (
                <>
                  <li>1 WhatsApp connection</li>
                  <li>100 messages per day</li>
                  <li>Account-scoped API key</li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/5 md:p-6">
          {!result ? (
            <form className="grid gap-5" onSubmit={handleSubmit}>
              {paymentStatus ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
                  {paymentStatus}
                </div>
              ) : null}

              <Field
                id="name"
                label="Your name"
                value={name}
                autoComplete="name"
                error={error?.issues?.name}
                onChange={setName}
              />
              <Field
                id="email"
                label="Email"
                type="email"
                value={email}
                autoComplete="email"
                error={error?.issues?.email}
                onChange={setEmail}
              />
              <Field
                id="projectName"
                label="Project name"
                value={projectName}
                autoComplete="organization"
                error={error?.issues?.projectName}
                onChange={setProjectName}
              />
              <Field
                id="password"
                label="Password"
                type="password"
                value={password}
                autoComplete="new-password"
                error={error?.issues?.password}
                onChange={setPassword}
              />

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                  {error.error}
                </div>
              ) : null}

              {requiresPaymentFirst && selectedPlan ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                  Pay for this plan before adding account details.
                  <a
                    href={`/payment?plan=${selectedPlan}`}
                    className="ml-2 underline decoration-amber-700 underline-offset-4"
                  >
                    Open payment
                  </a>
                </div>
              ) : null}

              {waitsForPaymentConfirmation ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                  Waiting for Mercado Pago confirmation. This usually takes a
                  few seconds after returning from payment.
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  requiresPaymentFirst ||
                  waitsForPaymentConfirmation
                }
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting
                  ? selectedPlan
                    ? "Creating account..."
                    : "Creating account..."
                  : selectedPlanDetails
                    ? "Create account"
                    : "Start today"}
              </button>

              <a
                href="/#pricing"
                className="text-center text-sm font-semibold text-slate-600 hover:text-slate-950"
              >
                Show all plans
              </a>
            </form>
          ) : (
            <div className="grid gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Account ready
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                  {result.account.projectName}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Connection: {result.connectionId}
                </p>
              </div>

              {result.qrImage ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">
                    Scan this QR in WhatsApp
                  </p>
                  <Image
                    src={result.qrImage}
                    alt="WhatsApp pairing QR"
                    width={320}
                    height={320}
                    unoptimized
                    className="mt-4 aspect-square w-full max-w-xs rounded-xl border border-slate-200 bg-white"
                  />
                  {qrStatus ? (
                    <p className="mt-3 text-sm text-slate-600">{qrStatus}</p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">
                    WhatsApp QR
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {qrStatus ??
                      "The account is ready, but the QR is still being generated."}
                  </p>
                  <button
                    type="button"
                    disabled={isFetchingQr}
                    onClick={() =>
                      void refreshQr({
                        apiKey: result.apiKey,
                        connectionId: result.connectionId,
                        attempts: 5,
                      })
                    }
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isFetchingQr ? "Refreshing..." : "Refresh QR"}
                  </button>
                </div>
              )}

              {result.pairingError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                  {result.pairingError}
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
                <p className="text-sm font-semibold">API key</p>
                <p className="mt-2 text-xs text-slate-400">
                  Store this now. It is only shown once.
                </p>
                <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
                  <code>{result.apiKey}</code>
                </pre>
              </div>

              <a
                href="/admin"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Open admin
              </a>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-950">
                    Send your first message
                  </p>
                </div>
                <pre className="overflow-x-auto p-4 text-xs leading-6 text-slate-700">
                  <code>{curlExample}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
