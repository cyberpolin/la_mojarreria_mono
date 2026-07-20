"use client";

import { FormEvent, useMemo, useState } from "react";

type BotPlan = "free" | "on_demand" | "high_usage";

const plans: Record<BotPlan, { name: string; price: string }> = {
  free: { name: "Free", price: "$2 included" },
  on_demand: { name: "On demand", price: "$5 minimum" },
  high_usage: { name: "High usage", price: "$20 minimum" },
};

function readPlan(): BotPlan {
  if (typeof window === "undefined") return "free";
  const value = new URLSearchParams(window.location.search).get("plan");
  return value === "on_demand" || value === "high_usage" ? value : "free";
}

export default function SignupPage() {
  const [plan] = useState<BotPlan>(readPlan);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [botName, setBotName] = useState("Customer assistant");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPlan = useMemo(() => plans[plan], [plan]);
  const paidPlanNeedsPayment = plan !== "free";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (paidPlanNeedsPayment) {
      window.location.href = `/payment?plan=${plan}`;
      return;
    }

    if (
      !name.trim() ||
      !email.trim() ||
      !projectName.trim() ||
      !botName.trim()
    ) {
      setError("Complete all account and bot fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const clientId = `bot_account_${Date.now()}`;
      const response = await fetch("/api/bot/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        clientToken?: string | null;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.clientToken) {
        throw new Error(payload?.error ?? "Could not create client token.");
      }

      window.localStorage.setItem(
        "TAKU_BOT_SESSION",
        JSON.stringify({
          account: {
            id: clientId,
            clientToken: payload.clientToken,
            name,
            email,
            projectName,
            plan,
            role: "client_user",
          },
          bot: {
            id: `bot_${Date.now()}`,
            name: botName,
          },
          createdAt: new Date().toISOString(),
        }),
      );
      window.location.href = "/admin";
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create bot account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

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

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-16 pt-6 md:grid-cols-[0.9fr_1.1fr] md:px-6">
        <div className="self-start">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Bot onboarding
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
            Start {selectedPlan.name} for {selectedPlan.price}.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            Create the first bot profile. For now this creates a local MVP
            session and opens the connected bot console.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5"
        >
          {[
            ["Your name", name, setName, "name"],
            ["Email", email, setEmail, "email"],
            ["Project name", projectName, setProjectName, "organization"],
            ["Bot name", botName, setBotName, "off"],
          ].map(([label, value, setter, autoComplete]) => (
            <label
              key={label as string}
              className="grid gap-2 text-sm font-medium text-slate-700"
            >
              {label as string}
              <input
                type={label === "Email" ? "email" : "text"}
                value={value as string}
                autoComplete={autoComplete as string}
                onChange={(event) =>
                  (setter as (nextValue: string) => void)(event.target.value)
                }
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
          ))}
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          {paidPlanNeedsPayment ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
              Prepaid tiers go through Mercado Pago first in this MVP.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {isSubmitting
              ? "Creating..."
              : paidPlanNeedsPayment
                ? "Continue to payment"
                : "Create bot"}
          </button>
        </form>
      </section>
    </main>
  );
}
