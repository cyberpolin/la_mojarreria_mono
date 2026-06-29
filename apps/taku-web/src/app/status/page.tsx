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

type RuntimeVariable = {
  name: string;
  configured: boolean;
  required: boolean;
};

type WebVariable = {
  name: string;
  value: string;
  required: boolean;
  sensitive?: boolean;
  purpose: string;
};

type RuntimeStatus = {
  state: HealthState;
  message: string | null;
  checkedAt: string | null;
  runtime: {
    host: string;
    port: number;
    dataFile: string;
    allowedOrigins: string[];
    waServiceBaseUrl: string;
    waServiceClientDomain: string;
    takuWebBaseUrl: string;
    mercadoPagoUseSandbox: boolean;
  } | null;
  variables: RuntimeVariable[];
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_API_BASE_URL ?? "http://localhost:3010";
const apiKey = process.env.NEXT_PUBLIC_TAKU_API_KEY ?? "";
const mercadoPagoPublicKey =
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

const webVariables: WebVariable[] = [
  {
    name: "NEXT_PUBLIC_TAKU_API_BASE_URL",
    value: apiBaseUrl,
    required: true,
    purpose: "Browser API target used by TAKU Web.",
  },
  {
    name: "NEXT_PUBLIC_TAKU_API_KEY",
    value: apiKey,
    required: true,
    sensitive: true,
    purpose: "Public service key sent by TAKU Web to TAKU API.",
  },
  {
    name: "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY",
    value: mercadoPagoPublicKey,
    required: true,
    sensitive: true,
    purpose: "Mercado Pago browser SDK public key for card payment UI.",
  },
];

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

function VariableRow({ variable }: { variable: RuntimeVariable }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-100">{variable.name}</p>
        <p className="mt-1 text-sm text-slate-400">
          {variable.configured
            ? "Configured on TAKU API"
            : variable.required
              ? "Missing on TAKU API"
              : "Not configured"}
        </p>
      </div>
      <StatusBadge
        state={variable.configured || !variable.required ? "ok" : "warn"}
      >
        {variable.configured
          ? "OK"
          : variable.required
            ? "Missing"
            : "Optional"}
      </StatusBadge>
    </div>
  );
}

function WebVariableRow({ variable }: { variable: WebVariable }) {
  const configured = Boolean(variable.value);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-100">{variable.name}</p>
        <p className="mt-1 break-all text-sm text-slate-400">
          {variable.sensitive
            ? maskValue(variable.value)
            : variable.value || "Missing"}
        </p>
        <p className="mt-1 text-xs text-slate-500">{variable.purpose}</p>
      </div>
      <StatusBadge state={configured || !variable.required ? "ok" : "warn"}>
        {configured ? "OK" : variable.required ? "Missing" : "Optional"}
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
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>({
    state: "checking",
    message: null,
    checkedAt: null,
    runtime: null,
    variables: [],
  });

  const apiHealthUrl = useMemo(
    () => `${apiBaseUrl.replace(/\/+$/, "")}/health`,
    [],
  );
  const runtimeStatusUrl = useMemo(
    () => `${apiBaseUrl.replace(/\/+$/, "")}/v1/runtime/status`,
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

  const checkRuntimeStatus = useCallback(async () => {
    setRuntimeStatus((current) => ({
      ...current,
      state: "checking",
      message: null,
    }));

    try {
      const response = await fetch(runtimeStatusUrl, {
        cache: "no-store",
        headers: {
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        runtime?: RuntimeStatus["runtime"];
        variables?: RuntimeVariable[];
        error?: string;
      } | null;

      setRuntimeStatus({
        state: response.ok && body?.ok ? "online" : "offline",
        message:
          response.ok && body?.ok
            ? null
            : (body?.error ?? `Runtime status returned ${response.status}`),
        checkedAt: new Date().toLocaleString(),
        runtime: body?.runtime ?? null,
        variables: body?.variables ?? [],
      });
    } catch (error) {
      setRuntimeStatus({
        state: "offline",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load TAKU API runtime status",
        checkedAt: new Date().toLocaleString(),
        runtime: null,
        variables: [],
      });
    }
  }, [runtimeStatusUrl]);

  useEffect(() => {
    void checkHealth();
    void checkRuntimeStatus();
  }, [checkHealth, checkRuntimeStatus]);

  const apiState =
    health.state === "online"
      ? "ok"
      : health.state === "checking"
        ? "checking"
        : "warn";
  const runtimeState =
    runtimeStatus.state === "online"
      ? "ok"
      : runtimeStatus.state === "checking"
        ? "checking"
        : "warn";
  const configuredWebVariables = webVariables.filter((variable) =>
    Boolean(variable.value),
  ).length;
  const missingRequiredWebVariables = webVariables.filter(
    (variable) => variable.required && !variable.value,
  ).length;

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
              onClick={() => {
                void checkHealth();
                void checkRuntimeStatus();
              }}
              disabled={
                health.state === "checking" ||
                runtimeStatus.state === "checking"
              }
              className="min-h-11 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </Panel>

        <Panel title="TAKU API Variables">
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-100">
                  Runtime status endpoint
                </p>
                <StatusBadge state={runtimeState}>
                  {runtimeStatus.state === "checking"
                    ? "Checking"
                    : runtimeStatus.state === "online"
                      ? "Loaded"
                      : "Unavailable"}
                </StatusBadge>
              </div>
              <p className="mt-2 break-all text-sm text-slate-400">
                {runtimeStatusUrl}
              </p>
              {runtimeStatus.checkedAt ? (
                <p className="mt-2 text-sm text-slate-500">
                  Checked {runtimeStatus.checkedAt}
                </p>
              ) : null}
              {runtimeStatus.message ? (
                <p className="mt-2 text-sm text-slate-300">
                  {runtimeStatus.message}
                </p>
              ) : null}
            </div>
          </div>

          {runtimeStatus.variables.length ? (
            <div className="space-y-3">
              {runtimeStatus.variables.map((variable) => (
                <VariableRow key={variable.name} variable={variable} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">
              Runtime variables are not loaded yet.
            </div>
          )}
        </Panel>

        {runtimeStatus.runtime ? (
          <Panel title="TAKU API Runtime Values">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [
                  "API bind",
                  `${runtimeStatus.runtime.host}:${runtimeStatus.runtime.port}`,
                ],
                ["TAKU Web URL", runtimeStatus.runtime.takuWebBaseUrl],
                ["WA Service URL", runtimeStatus.runtime.waServiceBaseUrl],
                [
                  "WA client domain",
                  runtimeStatus.runtime.waServiceClientDomain,
                ],
                [
                  "Mercado Pago mode",
                  runtimeStatus.runtime.mercadoPagoUseSandbox
                    ? "Sandbox"
                    : "Production",
                ],
                [
                  "Allowed origins",
                  runtimeStatus.runtime.allowedOrigins.join(", ") || "None",
                ],
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
        ) : null}

        <Panel title="TAKU Web Env Vars">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Configured
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-100">
                {configuredWebVariables} / {webVariables.length}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Missing Required
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-100">
                {missingRequiredWebVariables}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Build Target
              </p>
              <p className="mt-2 break-all text-sm font-semibold text-slate-100">
                {apiBaseUrl}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {webVariables.map((variable) => (
              <WebVariableRow key={variable.name} variable={variable} />
            ))}
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
