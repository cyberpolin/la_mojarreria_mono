"use client";

import { useEffect, useState } from "react";

type UsageSummary = {
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedProviderCostUsd?: number;
  estimatedChargeUsd: number;
  averageLatencyMs: number;
  byClient: Array<{
    clientId: string;
    requests: number;
    totalTokens: number;
    estimatedProviderCostUsd?: number;
    estimatedChargeUsd: number;
  }>;
  byAssistant: Array<{
    assistantId: string;
    requests: number;
    totalTokens: number;
    estimatedProviderCostUsd?: number;
    estimatedChargeUsd: number;
  }>;
};

type UsageEvent = {
  id: string;
  requestId: string;
  clientId: string | null;
  assistantId: string | null;
  billingTier?: string | null;
  model: string;
  status: "success" | "error";
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedProviderCostUsd?: number;
  estimatedChargeUsd?: number;
  chargeMarkupPercent?: number;
  latencyMs: number;
  errorCode: string | null;
  createdAt: string;
};

type SummaryResponse =
  | { ok: true; summary: UsageSummary }
  | { ok: false; error: string };

type EventsResponse =
  | { ok: true; events: UsageEvent[] }
  | { ok: false; error: string };

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "-";
}

function formatUsd(value: number | null | undefined) {
  return typeof value === "number" ? `$${value.toFixed(6)}` : "-";
}

function readSessionState() {
  try {
    const rawSession = window.localStorage.getItem("TAKU_BOT_SESSION");
    if (!rawSession) {
      return { isSuperAdmin: false, clientId: null, clientToken: null };
    }

    const session = JSON.parse(rawSession) as {
      account?: { id?: unknown; role?: unknown; clientToken?: unknown };
    };
    return {
      isSuperAdmin: session.account?.role === "superadmin",
      clientId:
        typeof session.account?.id === "string" ? session.account.id : null,
      clientToken:
        typeof session.account?.clientToken === "string"
          ? session.account.clientToken
          : null,
    };
  } catch {
    return { isSuperAdmin: false, clientId: null, clientToken: null };
  }
}

function Metric(params: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {params.label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">
        {params.value}
      </p>
    </div>
  );
}

export default function UsagePage() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [clientId, setClientId] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [status, setStatus] = useState("Loading usage");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [sessionClientId, setSessionClientId] = useState<string | null>(null);
  const [sessionClientToken, setSessionClientToken] = useState<string | null>(
    null,
  );

  async function loadUsage(
    superAdmin = isSuperAdmin,
    accountClientId = sessionClientId,
    accountClientToken = sessionClientToken,
  ) {
    setStatus("Loading usage");
    const params = new URLSearchParams();
    if (superAdmin && clientId.trim()) params.set("client_id", clientId.trim());
    if (assistantId.trim()) params.set("assistant_id", assistantId.trim());
    const roleHeaders: HeadersInit = {
      ...(superAdmin ? { "x-taku-role": "superadmin" } : {}),
      ...(accountClientId ? { "x-taku-client-id": accountClientId } : {}),
      ...(accountClientToken
        ? { "x-taku-client-token": accountClientToken }
        : {}),
    };

    const [summaryResponse, eventsResponse] = await Promise.all([
      fetch(`/api/bot/usage/summary?${params.toString()}`, {
        cache: "no-store",
        headers: roleHeaders,
      }),
      fetch(
        `/api/bot/usage/events?${new URLSearchParams({
          ...Object.fromEntries(params.entries()),
          limit: "50",
        }).toString()}`,
        { cache: "no-store", headers: roleHeaders },
      ),
    ]);

    const summaryPayload = (await summaryResponse
      .json()
      .catch(() => null)) as SummaryResponse | null;
    const eventsPayload = (await eventsResponse
      .json()
      .catch(() => null)) as EventsResponse | null;

    if (!summaryResponse.ok || !summaryPayload?.ok) {
      setStatus(
        summaryPayload && "error" in summaryPayload
          ? summaryPayload.error
          : `Usage summary failed with HTTP ${summaryResponse.status}`,
      );
      return;
    }

    if (!eventsResponse.ok || !eventsPayload?.ok) {
      setStatus(
        eventsPayload && "error" in eventsPayload
          ? eventsPayload.error
          : `Usage events failed with HTTP ${eventsResponse.status}`,
      );
      return;
    }

    setSummary(summaryPayload.summary);
    setEvents(eventsPayload.events);
    setStatus("Usage loaded");
  }

  useEffect(() => {
    const session = readSessionState();
    setIsSuperAdmin(session.isSuperAdmin);
    setSessionClientId(session.clientId);
    setSessionClientToken(session.clientToken);
    setClientId(session.isSuperAdmin ? "" : (session.clientId ?? ""));
    void loadUsage(session.isSuperAdmin, session.clientId, session.clientToken);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/admin" className="text-sm font-bold tracking-[0.2em]">
          TAKU BOT
        </a>
        <div className="flex items-center gap-2">
          <a
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Assistants
          </a>
          <a
            href="/status"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Status
          </a>
        </div>
      </nav>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-16 pt-6 md:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Usage
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
            {isSuperAdmin ? "System and client usage." : "Your usage."}
          </h1>
          <p className="mt-4 text-sm text-slate-600">{status}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          <div
            className={`grid gap-4 ${
              isSuperAdmin
                ? "md:grid-cols-[1fr_1fr_auto]"
                : "md:grid-cols-[1fr_auto]"
            }`}
          >
            {isSuperAdmin ? (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Client id
                <input
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  placeholder="all clients"
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            ) : null}
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Assistant id
              <input
                value={assistantId}
                onChange={(event) => setAssistantId(event.target.value)}
                placeholder="all assistants"
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadUsage()}
              className="self-end inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {summary ? (
          <>
            <div
              className={`grid gap-4 md:grid-cols-3 ${
                isSuperAdmin ? "xl:grid-cols-6" : "xl:grid-cols-5"
              }`}
            >
              <Metric label="Requests" value={formatNumber(summary.requests)} />
              <Metric
                label="Total tokens"
                value={formatNumber(summary.totalTokens)}
              />
              <Metric
                label="Prompt tokens"
                value={formatNumber(summary.promptTokens)}
              />
              <Metric
                label="Completion tokens"
                value={formatNumber(summary.completionTokens)}
              />
              {isSuperAdmin ? (
                <Metric
                  label="Provider cost"
                  value={formatUsd(summary.estimatedProviderCostUsd)}
                />
              ) : null}
              <Metric
                label="Charge estimate"
                value={formatUsd(summary.estimatedChargeUsd)}
              />
            </div>

            <div
              className={`grid gap-6 ${isSuperAdmin ? "lg:grid-cols-2" : ""}`}
            >
              {isSuperAdmin ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
                  <p className="text-sm font-semibold text-slate-950">
                    By client
                  </p>
                  <div className="mt-4 divide-y divide-slate-200">
                    {summary.byClient.map((client) => (
                      <div
                        key={client.clientId}
                        className="grid grid-cols-[1fr_auto_auto_auto] gap-3 py-3 text-sm"
                      >
                        <span className="break-all font-medium text-slate-950">
                          {client.clientId}
                        </span>
                        <span className="text-slate-500">
                          {formatNumber(client.requests)} req
                        </span>
                        <span className="font-semibold text-slate-950">
                          {formatNumber(client.totalTokens)} tokens
                        </span>
                        <span className="font-semibold text-slate-950">
                          {formatUsd(client.estimatedChargeUsd)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
                <p className="text-sm font-semibold text-slate-950">
                  By assistant
                </p>
                <div className="mt-4 divide-y divide-slate-200">
                  {summary.byAssistant.map((assistant) => (
                    <div
                      key={assistant.assistantId}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-3 py-3 text-sm"
                    >
                      <span className="break-all font-medium text-slate-950">
                        {assistant.assistantId}
                      </span>
                      <span className="text-slate-500">
                        {formatNumber(assistant.requests)} req
                      </span>
                      <span className="font-semibold text-slate-950">
                        {formatNumber(assistant.totalTokens)} tokens
                      </span>
                      <span className="font-semibold text-slate-950">
                        {formatUsd(assistant.estimatedChargeUsd)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          <p className="text-sm font-semibold text-slate-950">Recent events</p>
          <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  {isSuperAdmin ? <th className="px-4 py-3">Client</th> : null}
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Assistant</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Tokens</th>
                  {isSuperAdmin ? (
                    <th className="px-4 py-3">Provider</th>
                  ) : null}
                  <th className="px-4 py-3">Charge</th>
                  <th className="px-4 py-3">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    {isSuperAdmin ? (
                      <td className="px-4 py-3">
                        {event.clientId ?? "unknown"}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">{event.billingTier ?? "-"}</td>
                    <td className="px-4 py-3">{event.assistantId ?? "none"}</td>
                    <td className="px-4 py-3">{event.status}</td>
                    <td className="px-4 py-3">{event.model}</td>
                    <td className="px-4 py-3">
                      {formatNumber(event.totalTokens)}
                    </td>
                    {isSuperAdmin ? (
                      <td className="px-4 py-3">
                        {formatUsd(event.estimatedProviderCostUsd)}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      {formatUsd(event.estimatedChargeUsd)}
                    </td>
                    <td className="px-4 py-3">{event.latencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
