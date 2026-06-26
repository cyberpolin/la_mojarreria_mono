"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { storeSession, type TakuSession } from "../session";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_API_BASE_URL ?? "http://localhost:3010";
const apiKey = process.env.NEXT_PUBLIC_TAKU_API_KEY ?? "";

type LoginResponse = {
  ok: true;
  token: string;
  session: TakuSession;
};

async function login(params: {
  email: string;
  password: string;
}): Promise<LoginResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/session/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify(params),
  });
  const body = (await response.json().catch(() => null)) as
    | LoginResponse
    | { error?: string }
    | null;

  if (!response.ok || !body || !("token" in body)) {
    throw new Error(
      body && "error" in body && body.error ? body.error : "Login failed",
    );
  }

  return body;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await login({ email, password });
      storeSession(result);
      window.location.href =
        result.session.role === "superowner" ? "/dashboard" : "/onboarding";
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          TAKU
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-50">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Use a TAKU session to access the admin and client onboarding screens.
        </p>

        {error ? (
          <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={submit}
          className="mt-6 space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4"
        >
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-50 outline-none focus:border-slate-400"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-200">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-50 outline-none focus:border-slate-400"
            />
          </label>
          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="min-h-11 w-full rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs leading-5 text-slate-400">
          <p>Client users are created from onboarding.</p>
          <p>Superowner uses the configured TAKU superowner credentials.</p>
        </div>

        <Link
          href="/"
          className="mt-6 text-sm text-slate-400 hover:text-slate-100"
        >
          Back
        </Link>
      </div>
    </main>
  );
}
