"use client";

import { FormEvent, useEffect, useState } from "react";

function hasLocalSession() {
  try {
    return Boolean(window.localStorage.getItem("TAKU_BOT_SESSION"));
  } catch {
    return false;
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hasLocalSession()) {
      window.location.replace("/admin");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; session: unknown }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setError(
          payload && "error" in payload
            ? payload.error
            : `Login failed with HTTP ${response.status}`,
        );
        return;
      }

      window.localStorage.setItem(
        "TAKU_BOT_SESSION",
        JSON.stringify(payload.session),
      );
      window.location.href = "/admin";
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Login failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU BOT
        </a>
        <a
          href="/signup"
          className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
        >
          Start today
        </a>
      </nav>

      <section className="mx-auto grid w-full max-w-md px-4 py-12 md:px-6">
        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            TAKU BOT
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">Log in</h1>
          <div className="mt-6 grid gap-5">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
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
              {isSubmitting ? "Logging in" : "Log in"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
