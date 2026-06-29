"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type HealthState = "checking" | "online" | "offline";

type HealthResult = {
  state: HealthState;
  statusCode: number | null;
  service: string | null;
  message: string | null;
  checkedAt: string | null;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_API_BASE_URL ?? "http://localhost:3010";
const apiKey = process.env.NEXT_PUBLIC_TAKU_API_KEY ?? "";
const mercadoPagoPublicKey =
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

function maskValue(value: string) {
  if (!value) return "Missing";
  if (value.length <= 8) return `${value.length} chars configured`;
  return `${value.slice(0, 4)}...${value.slice(-4)} (${value.length} chars)`;
}

function badgeClass(state: "ok" | "warn" | "checking") {
  if (state === "ok") {
    return "border-slate-600 bg-slate-100 text-slate-950";
  }

  if (state === "checking") {
    return "border-slate-700 bg-slate-900 text-slate-300";
  }

  return "border-slate-700 bg-slate-950 text-slate-400";
}

function StatusBadge({
  state,
  children,
}: {
  state: "ok" | "warn" | "checking";
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-lg border px-3 text-xs font-semibold ${badgeClass(
        state,
      )}`}
    >
      {children}
    </span>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EnvRow({
  label,
  value,
  required,
  sensitive = false,
}: {
  label: string;
  value: string;
  required: boolean;
  sensitive?: boolean;
}) {
  const present = Boolean(value);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        <p className="mt-1 break-all text-sm text-slate-400">
          {sensitive ? maskValue(value) : value || "Missing"}
        </p>
      </div>
      <StatusBadge state={present || !required ? "ok" : "warn"}>
        {present ? "Configured" : required ? "Required" : "Optional"}
      </StatusBadge>
    </div>
  );
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResult>({
    state: "checking",
    statusCode: null,
    service: null,
    message: null,
    checkedAt: null,
  });

  const apiHealthUrl = useMemo(
    () => `${apiBaseUrl.replace(/\/+$/, "")}/health`,
    [],
  );

  const checkHealth = useCallback(async () => {
    setHealth((current) => ({
      ...current,
      state: "checking",
      message: null,
    }));

    try {
      const response = await fetch(apiHealthUrl, { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        service?: string;
      } | null;

      setHealth({
        state: response.ok && body?.ok ? "online" : "offline",
        statusCode: response.status,
        service: body?.service ?? null,
        message:
          response.ok && body?.ok
            ? null
            : `Health check returned ${response.status}`,
        checkedAt: new Date().toLocaleString(),
      });
    } catch (error) {
      setHealth({
        state: "offline",
        statusCode: null,
        service: null,
        message:
          error instanceof Error ? error.message : "Unable to reach TAKU API",
        checkedAt: new Date().toLocaleString(),
      });
    }
  }, [apiHealthUrl]);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const apiState =
    health.state === "online"
      ? "ok"
      : health.state === "checking"
        ? "checking"
        : "warn";

  return (
    <main className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              TAKU Status
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">
              Environment & Runtime
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="flex min-h-10 items-center justify-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            >
              Home
            </Link>
            <Link
              href="/docs"
              className="flex min-h-10 items-center justify-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            >
              Docs
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 md:px-6">
        <Panel title="Live Checks">
          <div className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-950 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-100">
                  TAKU API health
                </p>
                <StatusBadge state={apiState}>
                  {health.state === "checking"
                    ? "Checking"
                    : health.state === "online"
                      ? "Online"
                      : "Offline"}
                </StatusBadge>
              </div>
              <p className="mt-2 break-all text-sm text-slate-400">
                {apiHealthUrl}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {health.service
                  ? `Service: ${health.service}`
                  : "No service name"}
                {health.statusCode ? ` / HTTP ${health.statusCode}` : ""}
                {health.checkedAt ? ` / ${health.checkedAt}` : ""}
              </p>
              {health.message ? (
                <p className="mt-2 text-sm text-slate-300">{health.message}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void checkHealth()}
              disabled={health.state === "checking"}
              className="min-h-11 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </Panel>

        <Panel title="Browser Environment">
          <div className="space-y-3">
            <EnvRow
              label="NEXT_PUBLIC_TAKU_API_BASE_URL"
              value={apiBaseUrl}
              required
            />
            <EnvRow
              label="NEXT_PUBLIC_TAKU_API_KEY"
              value={apiKey}
              required
              sensitive
            />
            <EnvRow
              label="NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY"
              value={mercadoPagoPublicKey}
              required
              sensitive
            />
          </div>
        </Panel>

        <Panel title="Expected Production Domains">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["TAKU Web", "app.taku.lat"],
              ["TAKU API", "api.taku.lat"],
              ["WA Service", "api.wa.taku.lat"],
              ["Bot Service", "api.bot.taku.lat"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-800 bg-slate-950 p-4"
              >
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-slate-100">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  );
}
