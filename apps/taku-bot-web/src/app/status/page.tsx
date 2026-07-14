"use client";

import { useEffect, useState } from "react";

type HealthState = "checking" | "online" | "offline";

type EnvVariable = {
  name: string;
  configured: boolean;
  required: boolean;
  value?: string;
  maskedValue?: string | null;
};

type EnvResponse =
  | {
      ok: true;
      checkedAt: string;
      variables: EnvVariable[];
      runtime?: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
    };

function VariableTable(params: {
  title: string;
  subtitle: string;
  variables: EnvVariable[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
      <div>
        <p className="text-sm font-semibold text-slate-950">{params.title}</p>
        <p className="mt-1 text-sm text-slate-500">{params.subtitle}</p>
      </div>
      <div className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200">
        {params.variables.map((variable) => (
          <div
            key={variable.name}
            className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto]"
          >
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {variable.name}
              </p>
              {variable.value || variable.maskedValue ? (
                <p className="mt-1 break-all text-xs text-slate-500">
                  {variable.value ?? variable.maskedValue}
                </p>
              ) : null}
            </div>
            <span
              className={`inline-flex min-h-8 items-center justify-center rounded-full border px-3 text-xs font-semibold ${
                variable.configured
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-red-300 bg-red-50 text-red-700"
              }`}
            >
              {variable.configured ? "OK" : "Missing"}
            </span>
            <span className="inline-flex min-h-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600">
              {variable.required ? "Required" : "Optional"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [message, setMessage] = useState("Checking bot-service");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [webEnv, setWebEnv] = useState<EnvResponse | null>(null);
  const [botRuntime, setBotRuntime] = useState<EnvResponse | null>(null);

  async function checkStatus() {
    setHealth("checking");
    setMessage("Checking bot-service");

    const checked = new Date().toLocaleString();
    setCheckedAt(checked);

    const [healthResult, webEnvResult, botRuntimeResult] = await Promise.all([
      fetch("/api/bot/health", { cache: "no-store" }),
      fetch("/api/status/env", { cache: "no-store" }),
      fetch("/api/bot/runtime", { cache: "no-store" }),
    ]);

    const healthPayload = (await healthResult.json().catch(() => null)) as {
      ok?: boolean;
    } | null;
    const webPayload = (await webEnvResult
      .json()
      .catch(() => null)) as EnvResponse | null;
    const botPayload = (await botRuntimeResult
      .json()
      .catch(() => null)) as EnvResponse | null;

    setWebEnv(webPayload);
    setBotRuntime(botPayload);

    if (healthResult.ok && healthPayload?.ok) {
      setHealth("online");
      setMessage("bot-service is responding");
      return;
    }

    setHealth("offline");
    setMessage(`Health check returned HTTP ${healthResult.status}`);
  }

  useEffect(() => {
    void checkStatus();
  }, []);

  const badge =
    health === "online"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : health === "checking"
        ? "border-slate-300 bg-slate-100 text-slate-700"
        : "border-red-300 bg-red-50 text-red-700";
  const botApiTarget = webEnv?.ok
    ? (webEnv.variables.find(
        (variable) => variable.name === "TAKU_BOT_API_BASE_URL",
      )?.value ?? "Missing")
    : "Checking";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU BOT
        </a>
        <a
          href="/"
          className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
        >
          Back
        </a>
      </nav>

      <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 md:px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Status
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-950">
            TAKU Bot runtime.
          </h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${badge}`}
            >
              {health === "online"
                ? "Online"
                : health === "checking"
                  ? "Checking"
                  : "Offline"}
            </span>
            <p className="text-sm text-slate-600">{message}</p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Bot API target</p>
              <p className="mt-2 break-all text-sm font-semibold text-slate-950">
                {botApiTarget}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Last check</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {checkedAt ?? "-"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void checkStatus()}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Run check
          </button>
        </div>

        {webEnv?.ok ? (
          <VariableTable
            title="TAKU Bot Web Env Vars"
            subtitle="Variables configured on the Next app."
            variables={webEnv.variables}
          />
        ) : null}

        {botRuntime?.ok ? (
          <VariableTable
            title="Bot Service Env Vars"
            subtitle="Variables reported by bot-service."
            variables={botRuntime.variables}
          />
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
            {botRuntime && "error" in botRuntime
              ? botRuntime.error
              : "Bot service runtime variables could not be loaded."}
          </div>
        )}
      </section>
    </main>
  );
}
