"use client";

import { useMemo, useState } from "react";
import { getBackendApiBaseUrl } from "../../lib/auth";

type CheckState = "idle" | "loading" | "online" | "degraded" | "error";

type HealthPayload = {
  ok?: boolean;
  data?: {
    status?: string;
    timestamp?: string;
    services?: Record<string, string>;
  };
  error?: {
    message?: string;
  };
};

type RuntimePayload = {
  ok?: boolean;
  data?: {
    service: string;
    checkedAt: string;
    runtime: {
      environment: string;
      host: string;
      port: number;
      dataFile: string;
      allowedOrigins: string[];
      takuWaBaseUrl: string;
      botServiceBaseUrl: string;
    };
    variables: Array<{
      name: string;
      configured: boolean;
      required: boolean;
    }>;
  };
  error?: {
    message?: string;
  };
};

const publicEnvVars = [
  {
    name: "NEXT_PUBLIC_TAKU_SITE_URL",
    value: process.env.NEXT_PUBLIC_TAKU_SITE_URL,
    description: "Public TAKU site URL used by browser flows.",
  },
  {
    name: "NEXT_PUBLIC_TAKU_BACKEND_API_BASE_URL",
    value: process.env.NEXT_PUBLIC_TAKU_BACKEND_API_BASE_URL,
    description: "Browser target for the unified TAKU backend.",
  },
  {
    name: "NEXT_PUBLIC_TAKU_BACKEND_API_KEY",
    value: process.env.NEXT_PUBLIC_TAKU_BACKEND_API_KEY,
    description: "Legacy public API key value, if still configured.",
  },
  {
    name: "NEXT_PUBLIC_TAKU_WA_WEB_URL",
    value: process.env.NEXT_PUBLIC_TAKU_WA_WEB_URL,
    description: "Public URL for the WA product UI.",
  },
  {
    name: "NEXT_PUBLIC_TAKU_BOT_WEB_URL",
    value: process.env.NEXT_PUBLIC_TAKU_BOT_WEB_URL,
    description: "Public URL for the Bot product UI.",
  },
];

function statusClasses(state: CheckState) {
  if (state === "online") return "bg-emerald-50 text-emerald-700";
  if (state === "degraded") return "bg-amber-50 text-amber-700";
  if (state === "error") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function maskValue(value: string | undefined) {
  if (!value) return "Missing";
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function StatusPage() {
  const backendBaseUrl = useMemo(
    () => getBackendApiBaseUrl().replace(/\/$/, ""),
    [],
  );
  const [password, setPassword] = useState("");
  const [state, setState] = useState<CheckState>("idle");
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [ready, setReady] = useState<HealthPayload | null>(null);
  const [runtime, setRuntime] = useState<RuntimePayload | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runChecks() {
    setState("loading");
    setError(null);
    setRuntime(null);
    const startedAt = performance.now();

    try {
      const [healthResponse, readyResponse, runtimeResponse] =
        await Promise.all([
          fetch(`${backendBaseUrl}/health`),
          fetch(`${backendBaseUrl}/health/ready`),
          fetch(`${backendBaseUrl}/runtime/status`, {
            headers: { "x-taku-status-password": password },
          }),
        ]);

      const [healthPayload, readyPayload, runtimePayload] = await Promise.all([
        healthResponse
          .json()
          .catch(() => null) as Promise<HealthPayload | null>,
        readyResponse.json().catch(() => null) as Promise<HealthPayload | null>,
        runtimeResponse
          .json()
          .catch(() => null) as Promise<RuntimePayload | null>,
      ]);

      setLatencyMs(Math.round(performance.now() - startedAt));
      setHealth(healthPayload);
      setReady(readyPayload);
      setRuntime(runtimePayload);

      if (!healthResponse.ok || !readyResponse.ok || !runtimeResponse.ok) {
        setState("degraded");
        setError(
          runtimePayload?.error?.message ??
            readyPayload?.error?.message ??
            healthPayload?.error?.message ??
            "One or more backend checks failed.",
        );
        return;
      }

      setState(
        healthPayload?.ok && readyPayload?.ok && runtimePayload?.ok
          ? "online"
          : "degraded",
      );
    } catch (requestError) {
      setLatencyMs(Math.round(performance.now() - startedAt));
      setState("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not reach TAKU backend.",
      );
    }
  }

  const backendVars = runtime?.data?.variables ?? [];
  const missingBackendVars = backendVars.filter(
    (item) => item.required && !item.configured,
  );
  const configuredPublicVars = publicEnvVars.filter(
    (item) => item.value,
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.24em]">
          TAKU
        </a>
        <div className="flex items-center gap-2">
          <a
            href="/"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Home
          </a>
          <a
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Login
          </a>
        </div>
      </nav>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              TAKU Status
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 md:text-5xl">
              Environment & backend
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Checks that taku.lat can reach api.taku.lat and verifies required
              runtime variables without displaying secret values.
            </p>
          </div>
          <span
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${statusClasses(state)}`}
          >
            {state === "idle"
              ? "Not checked"
              : state === "loading"
                ? "Checking..."
                : state === "online"
                  ? "Online"
                  : state === "degraded"
                    ? "Degraded"
                    : "Offline"}
          </span>
        </div>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 md:p-6">
          <label
            htmlFor="status-password"
            className="text-sm font-semibold text-slate-950"
          >
            TAKU superadmin password
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="status-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Required to fetch backend runtime status"
              className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
            />
            <button
              type="button"
              onClick={() => void runChecks()}
              disabled={state === "loading" || !password}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {state === "loading" ? "Checking..." : "Run check"}
            </button>
          </div>
          {error ? (
            <p className="mt-3 text-sm font-medium text-red-700">{error}</p>
          ) : null}
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Backend health
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {health?.ok ? "Online" : state === "idle" ? "-" : "Failed"}
            </p>
            <p className="mt-2 break-all text-sm text-slate-600">
              {backendBaseUrl}/health
            </p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Ready check
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {ready?.ok ? "Ready" : state === "idle" ? "-" : "Failed"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {ready?.data?.services
                ? Object.entries(ready.data.services)
                    .map(([name, value]) => `${name}: ${value}`)
                    .join(" / ")
                : "No ready payload loaded."}
            </p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Latency
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {latencyMs === null ? "-" : `${latencyMs}ms`}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Last browser check from taku.lat.
            </p>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Backend env vars
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Required runtime configuration
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Missing {missingBackendVars.length}
            </span>
          </div>
          <div className="mt-5 grid gap-2">
            {backendVars.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Enter the superadmin password and run the check.
              </div>
            ) : null}
            {backendVars.map((item) => (
              <div
                key={item.name}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-950">
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.required ? "Required" : "Optional"}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                    item.configured
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {item.configured ? "OK" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                TAKU site env vars
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Public browser configuration
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Configured {configuredPublicVars} / {publicEnvVars.length}
            </span>
          </div>
          <div className="mt-5 grid gap-2">
            {publicEnvVars.map((item) => (
              <div
                key={item.name}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-950">
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.description}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                    item.value
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {maskValue(item.value)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {runtime?.data ? (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Runtime values
            </p>
            <dl className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              {[
                ["Environment", runtime.data.runtime.environment],
                [
                  "Bind",
                  `${runtime.data.runtime.host}:${runtime.data.runtime.port}`,
                ],
                ["Data file", runtime.data.runtime.dataFile],
                [
                  "Allowed origins",
                  runtime.data.runtime.allowedOrigins.join(", "),
                ],
                ["WA API", runtime.data.runtime.takuWaBaseUrl],
                ["Bot API", runtime.data.runtime.botServiceBaseUrl],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <dt className="font-semibold text-slate-950">{label}</dt>
                  <dd className="mt-1 break-all">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </section>
    </main>
  );
}
