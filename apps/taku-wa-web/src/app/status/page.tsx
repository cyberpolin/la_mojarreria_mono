"use client";

import { FormEvent, useMemo, useState } from "react";

type HealthState = "checking" | "online" | "degraded" | "offline";

type CheckRecord = {
  checkedAt: string;
  latencyMs: number | null;
  state: Exclude<HealthState, "checking">;
  label: string;
};

type WebVariable = {
  name: string;
  value: string;
  required: boolean;
  sensitive?: boolean;
  purpose: string;
  valid?: boolean;
  warning?: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_API_BASE_URL ?? "http://localhost:3001";
const healthUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_HEALTH_URL ??
  `${apiBaseUrl.replace(/\/+$/, "")}/health`;
const mercadoPagoPublicKey =
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";
const apiBaseUrlTargetsWaService = /\/\/api\.wa\./.test(apiBaseUrl);
const healthUrlTargetsWaService = /\/\/api\.wa\./.test(healthUrl);
const healthUrlUsesPublicEndpoint = /\/health\/?$/.test(healthUrl);

const webVariables: WebVariable[] = [
  {
    name: "NEXT_PUBLIC_TAKU_WA_API_BASE_URL",
    value: apiBaseUrl,
    required: true,
    valid: apiBaseUrlTargetsWaService,
    warning: "Production WA Web should point to the WA API domain.",
    purpose: "Browser API target used by TAKU WA Web.",
  },
  {
    name: "NEXT_PUBLIC_TAKU_WA_HEALTH_URL",
    value: healthUrl,
    required: true,
    valid: healthUrlTargetsWaService && healthUrlUsesPublicEndpoint,
    warning: "Health checks should hit the public WA API /health endpoint.",
    purpose: "Public health endpoint checked by this status page.",
  },
  {
    name: "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY",
    value: mercadoPagoPublicKey,
    required: true,
    sensitive: true,
    purpose: "Mercado Pago browser SDK public key for payment UI.",
  },
];

const stateCopy: Record<
  HealthState,
  { label: string; detail: string; tone: string; ring: string }
> = {
  checking: {
    label: "Checking",
    detail: "Running a live health check against the bridge.",
    tone: "text-slate-500",
    ring: "border-slate-300 bg-slate-100",
  },
  online: {
    label: "Operational",
    detail: "The public health endpoint is responding normally.",
    tone: "text-emerald-700",
    ring: "border-emerald-300 bg-emerald-50",
  },
  degraded: {
    label: "Degraded",
    detail: "The health endpoint responded, but not with a healthy result.",
    tone: "text-amber-700",
    ring: "border-amber-300 bg-amber-50",
  },
  offline: {
    label: "Offline",
    detail: "The health endpoint is not reachable from this browser.",
    tone: "text-red-700",
    ring: "border-red-300 bg-red-50",
  },
};

function StatusOrb({ state }: { state: HealthState }) {
  const isOnline = state === "online";
  const isChecking = state === "checking";
  const isDegraded = state === "degraded";
  const pulseClass = isChecking || isOnline ? "animate-ping" : "";
  const colorClass = isOnline
    ? "bg-emerald-500"
    : isDegraded
      ? "bg-amber-500"
      : state === "offline"
        ? "bg-red-500"
        : "bg-slate-400";

  return (
    <div className="relative flex h-52 w-52 items-center justify-center rounded-full border border-slate-200 bg-white shadow-2xl shadow-slate-950/10">
      <span
        className={`absolute h-32 w-32 rounded-full opacity-20 ${pulseClass} ${colorClass}`}
      />
      <span
        className={`absolute h-28 w-28 rounded-full opacity-30 ${colorClass}`}
      />
      <span className={`relative h-16 w-16 rounded-full ${colorClass}`} />
    </div>
  );
}

function maskValue(value: string) {
  if (!value) return "Missing";
  if (value.length <= 8) return `${value.length} chars configured`;
  return `${value.slice(0, 4)}...${value.slice(-4)} (${value.length} chars)`;
}

function WebVariableRow({ variable }: { variable: WebVariable }) {
  const configured = Boolean(variable.value);
  const valid = variable.valid ?? true;
  const ok = (configured || !variable.required) && valid;

  return (
    <div className="grid gap-3 border-t border-slate-200 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="text-sm font-semibold text-slate-950">{variable.name}</p>
        <p className="mt-1 break-all text-sm text-slate-600">
          {variable.sensitive
            ? maskValue(variable.value)
            : variable.value || "Missing"}
        </p>
        <p className="mt-1 text-xs text-slate-500">{variable.purpose}</p>
        {configured && !valid && variable.warning ? (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            {variable.warning}
          </p>
        ) : null}
      </div>
      <span
        className={`inline-flex min-h-8 items-center justify-center rounded-full border px-3 text-xs font-semibold ${
          ok
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : configured
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-red-300 bg-red-50 text-red-700"
        }`}
      >
        {ok
          ? "OK"
          : configured
            ? "Check target"
            : variable.required
              ? "Missing"
              : "Optional"}
      </span>
    </div>
  );
}

export default function StatusPage() {
  const [state, setState] = useState<HealthState>("offline");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [records, setRecords] = useState<CheckRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusPassword, setStatusPassword] = useState("");
  const [accessGranted, setAccessGranted] = useState(false);

  const copy = stateCopy[state];
  const lastChecked = records[0]?.checkedAt ?? null;
  const uptimeScore = useMemo(() => {
    if (records.length === 0) return "Waiting";
    const healthy = records.filter(
      (record) => record.state === "online",
    ).length;
    return `${Math.round((healthy / records.length) * 100)}%`;
  }, [records]);
  const configuredWebVariables = webVariables.filter((variable) =>
    Boolean(variable.value),
  ).length;
  const missingRequiredWebVariables = webVariables.filter(
    (variable) => variable.required && !variable.value,
  ).length;
  const invalidWebVariables = webVariables.filter(
    (variable) => variable.value && variable.valid === false,
  ).length;

  const runCheck = async (password: string) => {
    setState("checking");
    setError(null);
    const startedAt = performance.now();

    try {
      const response = await fetch("/api/status/health", {
        cache: "no-store",
        headers: {
          "x-taku-status-password": password,
        },
      });
      const elapsed = Math.round(performance.now() - startedAt);
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        healthOk?: boolean;
        error?: string;
        statusText?: string;
        payload?: {
          ok?: boolean;
          version?: string;
        };
      } | null;
      const nextState: CheckRecord["state"] =
        response.ok && payload?.ok && payload.healthOk ? "online" : "degraded";

      setState(nextState);
      setLatencyMs(elapsed);
      setAccessGranted(response.ok && payload?.ok === true);
      setRecords((current) =>
        [
          {
            checkedAt: new Date().toISOString(),
            latencyMs: elapsed,
            state: nextState,
            label: payload?.payload?.version
              ? `v${payload.payload.version}`
              : (payload?.statusText ?? response.statusText),
          } satisfies CheckRecord,
          ...current,
        ].slice(0, 5),
      );
      if (!response.ok || !payload?.ok || !payload.healthOk) {
        setError(
          payload?.error ??
            payload?.statusText ??
            `Health check returned ${response.status}`,
        );
      }
    } catch (checkError) {
      setState("offline");
      setLatencyMs(null);
      setError(
        checkError instanceof Error
          ? checkError.message
          : "Unable to reach health endpoint",
      );
      setRecords((current) =>
        [
          {
            checkedAt: new Date().toISOString(),
            latencyMs: null,
            state: "offline",
            label: "unreachable",
          } satisfies CheckRecord,
          ...current,
        ].slice(0, 5),
      );
    }
  };

  const submitStatusPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = statusPassword.trim();
    if (!password) {
      setError("Enter the TAKU superowner password.");
      return;
    }

    void runCheck(password);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 md:px-6">
        <a
          href="/"
          className="text-sm font-bold tracking-[0.2em] text-slate-950"
        >
          TAKU
        </a>
        <a
          href="/"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-950"
        >
          Back home
        </a>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-7xl items-center gap-10 px-4 pb-16 pt-8 md:grid-cols-[0.9fr_1.1fr] md:px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Live service status
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] text-slate-950 md:text-7xl">
            TAKU WhatsApp Bridge status.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            This page checks the public health endpoint and shows the current
            bridge availability from your browser.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <form
              onSubmit={submitStatusPassword}
              className="grid w-full max-w-xl gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-950/5"
            >
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  TAKU superowner password
                </span>
                <input
                  type="password"
                  value={statusPassword}
                  onChange={(event) => setStatusPassword(event.target.value)}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm text-slate-950 outline-none hover:border-slate-400 focus:border-slate-950"
                />
              </label>
              <button
                type="submit"
                disabled={state === "checking" || !statusPassword.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === "checking"
                  ? "Checking"
                  : accessGranted
                    ? "Run check"
                    : "Unlock status"}
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-emerald-950/10">
          <div className="grid gap-8 md:grid-cols-[260px_1fr] md:items-center">
            <div className="flex justify-center">
              <StatusOrb state={state} />
            </div>
            <div>
              <div
                className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${copy.ring} ${copy.tone}`}
              >
                {copy.label}
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {copy.detail}
              </h2>
              {error ? (
                <p className="mt-4 text-sm leading-6 text-red-700">{error}</p>
              ) : null}
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Latency</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {latencyMs === null ? "-" : `${latencyMs}ms`}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Recent uptime</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {uptimeScore}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Last check</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {lastChecked
                      ? new Intl.DateTimeFormat(undefined, {
                          timeStyle: "medium",
                        }).format(new Date(lastChecked))
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 py-16">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Environment
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">
                TAKU WA Web variables
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Configured</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {configuredWebVariables} / {webVariables.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Missing required</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {missingRequiredWebVariables}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Target warnings</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  {invalidWebVariables}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {webVariables.map((variable) => (
              <WebVariableRow key={variable.name} variable={variable} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white py-16">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Recent checks
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">
                Browser health history
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Checks run only after password unlock.
            </p>
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {records.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No checks yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {records.map((record) => (
                  <div
                    key={`${record.checkedAt}-${record.state}`}
                    className="grid gap-3 bg-white p-5 sm:grid-cols-[1fr_140px_140px]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {stateCopy[record.state].label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                          timeStyle: "medium",
                        }).format(new Date(record.checkedAt))}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600">{record.label}</p>
                    <p className="text-sm font-semibold text-slate-950">
                      {record.latencyMs === null
                        ? "-"
                        : `${record.latencyMs}ms`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
