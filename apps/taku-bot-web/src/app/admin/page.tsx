"use client";

import { FormEvent, useEffect, useState } from "react";

type HealthState = "checking" | "online" | "offline";

type Assistant = {
  id: string;
  name: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
};

type AssistantsResponse =
  | {
      ok: true;
      assistants: Assistant[];
    }
  | {
      ok: false;
      error: string;
    };

type AssistantResponse =
  | {
      ok: true;
      assistant: Assistant;
    }
  | {
      ok: false;
      error: string;
    };

type BillingStatus = {
  tier: string;
  status: string;
  monthlyPeriod: string;
  remainingUsd: number;
  remainingPercent: number;
  lowBalance: boolean;
  includedRemainingUsd: number;
  prepaidRemainingUsd: number;
};

type BillingResponse =
  | {
      ok: true;
      billing: {
        tier: string;
        status: string;
        monthly_period: string;
        remaining_usd: number;
        remaining_percent: number;
        low_balance: boolean;
        included_remaining_usd: number;
        prepaid_remaining_usd: number;
      };
    }
  | { ok: false; error: string };

const starterInstructions =
  "You are TAKU Bot. Reply clearly, briefly, and ask one useful follow-up question when needed.";

function readSessionState() {
  try {
    const rawSession = window.localStorage.getItem("TAKU_BOT_SESSION");
    if (!rawSession) {
      return {
        hasSession: false,
        isSuperadmin: false,
        clientId: null,
        clientToken: null,
      };
    }

    const session = JSON.parse(rawSession) as {
      account?: { id?: unknown; role?: unknown; clientToken?: unknown };
    };
    return {
      hasSession: true,
      clientId:
        typeof session.account?.id === "string" ? session.account.id : null,
      clientToken:
        typeof session.account?.clientToken === "string"
          ? session.account.clientToken
          : null,
      isSuperadmin: session.account?.role === "superadmin",
    };
  } catch {
    return {
      hasSession: false,
      isSuperadmin: false,
      clientId: null,
      clientToken: null,
    };
  }
}

function clientHeaders(clientId: string | null, clientToken: string | null) {
  return {
    ...(clientId ? { "x-taku-client-id": clientId } : {}),
    ...(clientToken ? { "x-taku-client-token": clientToken } : {}),
  };
}

function saveClientTokenToSession(token: string) {
  const rawSession = window.localStorage.getItem("TAKU_BOT_SESSION");
  if (!rawSession) return;

  const session = JSON.parse(rawSession) as {
    account?: Record<string, unknown>;
  };
  window.localStorage.setItem(
    "TAKU_BOT_SESSION",
    JSON.stringify({
      ...session,
      account: {
        ...session.account,
        clientToken: token,
      },
    }),
  );
}

export default function BotConsolePage() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [healthMessage, setHealthMessage] = useState("Checking bot-service");
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [name, setName] = useState("Customer assistant");
  const [instructions, setInstructions] = useState(starterInstructions);
  const [assistantStatus, setAssistantStatus] = useState<string | null>(null);
  const [loadingAssistants, setLoadingAssistants] = useState(true);
  const [savingAssistant, setSavingAssistant] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [showClientToken, setShowClientToken] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState<string | null>(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingStatus, setBillingStatus] = useState("Loading billing");

  async function checkHealth() {
    setHealth("checking");
    setHealthMessage("Checking bot-service");

    try {
      const response = await fetch("/api/bot/health", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      if (response.ok && payload?.ok) {
        setHealth("online");
        setHealthMessage("bot-service is online");
        return;
      }

      setHealth("offline");
      setHealthMessage(`Health check returned HTTP ${response.status}`);
    } catch (error) {
      setHealth("offline");
      setHealthMessage(
        error instanceof Error ? error.message : "Unable to reach bot-service",
      );
    }
  }

  async function loadAssistants(
    sessionClientId = clientId,
    sessionClientToken = clientToken,
  ) {
    setLoadingAssistants(true);
    setAssistantStatus(null);

    try {
      const response = await fetch("/api/bot/assistants", {
        cache: "no-store",
        headers: clientHeaders(sessionClientId, sessionClientToken),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as AssistantsResponse | null;

      if (!response.ok || !payload?.ok) {
        setAssistantStatus(
          payload && "error" in payload
            ? payload.error
            : `Load failed with HTTP ${response.status}`,
        );
        return;
      }

      setAssistants(payload.assistants);
      setAssistantStatus(
        payload.assistants.length
          ? "Assistants loaded"
          : "No assistants yet. Create the first one.",
      );
    } catch (error) {
      setAssistantStatus(
        error instanceof Error ? error.message : "Unable to load assistants",
      );
    } finally {
      setLoadingAssistants(false);
    }
  }

  async function loadBilling(
    sessionClientId = clientId,
    sessionClientToken = clientToken,
  ) {
    if (!sessionClientId) {
      setBillingStatus("No account session");
      return;
    }

    try {
      const response = await fetch("/api/bot/billing/account", {
        cache: "no-store",
        headers: clientHeaders(sessionClientId, sessionClientToken),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as BillingResponse | null;
      if (!response.ok || !payload?.ok) {
        setBillingStatus(
          payload && "error" in payload
            ? payload.error
            : `Billing failed with HTTP ${response.status}`,
        );
        return;
      }

      setBilling({
        tier: payload.billing.tier,
        status: payload.billing.status,
        monthlyPeriod: payload.billing.monthly_period,
        remainingUsd: payload.billing.remaining_usd,
        remainingPercent: payload.billing.remaining_percent,
        lowBalance: payload.billing.low_balance,
        includedRemainingUsd: payload.billing.included_remaining_usd,
        prepaidRemainingUsd: payload.billing.prepaid_remaining_usd,
      });
      setBillingStatus("Billing loaded");
    } catch (error) {
      setBillingStatus(
        error instanceof Error ? error.message : "Unable to load billing",
      );
    }
  }

  async function saveAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAssistant(true);
    setAssistantStatus(null);

    try {
      const response = await fetch("/api/bot/assistants", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientHeaders(clientId, clientToken),
        },
        body: JSON.stringify({ name, instructions }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as AssistantResponse | null;

      if (!response.ok || !payload?.ok) {
        setAssistantStatus(
          payload && "error" in payload
            ? payload.error
            : `Save failed with HTTP ${response.status}`,
        );
        return;
      }

      window.location.href = `/admin/assistants/${encodeURIComponent(
        payload.assistant.id,
      )}`;
    } catch (error) {
      setAssistantStatus(
        error instanceof Error ? error.message : "Unable to save assistant",
      );
    } finally {
      setSavingAssistant(false);
    }
  }

  async function copyText(label: string, value: string | null) {
    if (!value) {
      setCredentialStatus(`${label} is not available.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCredentialStatus(`${label} copied.`);
    } catch {
      setCredentialStatus(`Could not copy ${label}.`);
    }
  }

  async function generateClientToken() {
    if (!clientId) {
      setCredentialStatus("Client id is not available.");
      return;
    }

    setCreatingToken(true);
    setCredentialStatus(null);
    try {
      const response = await fetch("/api/bot/client-token", {
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
        throw new Error(payload?.error ?? "Could not generate client token.");
      }

      saveClientTokenToSession(payload.clientToken);
      setClientToken(payload.clientToken);
      setShowClientToken(true);
      setCredentialStatus("Client token generated. Store it now.");
      void loadBilling(clientId, payload.clientToken);
      void loadAssistants(clientId, payload.clientToken);
    } catch (error) {
      setCredentialStatus(
        error instanceof Error
          ? error.message
          : "Could not generate client token.",
      );
    } finally {
      setCreatingToken(false);
    }
  }

  useEffect(() => {
    const session = readSessionState();
    setHasSession(session.hasSession);
    setIsSuperadmin(session.isSuperadmin);
    setClientId(session.clientId);
    setClientToken(session.clientToken);
    void checkHealth();
    void loadBilling(session.clientId, session.clientToken);
    void loadAssistants(session.clientId, session.clientToken);
  }, []);

  function logout() {
    window.localStorage.removeItem("TAKU_BOT_SESSION");
    window.location.href = "/";
  }

  const healthBadge =
    health === "online"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : health === "checking"
        ? "border-slate-300 bg-slate-100 text-slate-700"
        : "border-red-300 bg-red-50 text-red-700";
  const billingBadge =
    billing?.status === "active" && !billing.lowBalance
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : billing?.status === "active"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-red-300 bg-red-50 text-red-700";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU BOT
        </a>
        <div className="flex items-center gap-2">
          <a
            href="/status"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Status
          </a>
          <a
            href="/admin/usage"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Usage
          </a>
          {isSuperadmin ? (
            <a
              href="/admin/superadmin"
              className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
            >
              Superadmin
            </a>
          ) : null}
          {hasSession ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
            >
              Logout
            </button>
          ) : (
            <a
              href="/login"
              className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
            >
              Login
            </a>
          )}
        </div>
      </nav>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-16 pt-6 md:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Assistant console
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
                Manage TAKU assistants.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">
                Open an assistant to edit instructions and test the exact
                `/v1/chat/completions` request body clients will send.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${healthBadge}`}
                >
                  {health === "online"
                    ? "Online"
                    : health === "checking"
                      ? "Checking"
                      : "Offline"}
                </span>
                <p className="text-sm text-slate-600">{healthMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => void checkHealth()}
                className="mt-4 inline-flex min-h-10 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
              >
                Refresh health
              </button>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Account credit
              </p>
              <p className="mt-1 text-sm text-slate-500">{billingStatus}</p>
            </div>
            <span
              className={`inline-flex min-h-8 items-center self-start rounded-full border px-3 text-xs font-semibold capitalize ${billingBadge}`}
            >
              {billing?.status ?? "unknown"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Tier
              </p>
              <p className="mt-2 text-lg font-semibold capitalize text-slate-950">
                {billing?.tier.replace("_", " ") ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Remaining
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {typeof billing?.remainingUsd === "number"
                  ? `$${billing.remainingUsd.toFixed(4)}`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Remaining %
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {typeof billing?.remainingPercent === "number"
                  ? `${Math.round(billing.remainingPercent)}%`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Period
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {billing?.monthlyPeriod ?? "-"}
              </p>
            </div>
          </div>
          {billing?.lowBalance ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
              Balance is low. Add prepaid credit before replies stop.
            </div>
          ) : null}
          {billing && billing.status !== "active" ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              Bot replies are blocked until credit is added or the free monthly
              allowance resets.
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                API credentials
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Use both values on client API calls. The token is secret; copy
                and store it before resetting it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void generateClientToken()}
              disabled={creatingToken || !clientId}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingToken
                ? "Generating"
                : clientToken
                  ? "Reset token"
                  : "Generate token"}
            </button>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                TAKU_CLIENT_ID
              </p>
              <p className="mt-3 break-all font-mono text-sm text-slate-950">
                {clientId ?? "-"}
              </p>
              <button
                type="button"
                onClick={() => void copyText("Client id", clientId)}
                disabled={!clientId}
                className="mt-4 inline-flex min-h-10 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copy id
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                TAKU_CLIENT_TOKEN
              </p>
              <p className="mt-3 break-all font-mono text-sm text-slate-950">
                {clientToken
                  ? showClientToken
                    ? clientToken
                    : `${clientToken.slice(0, 12)}...${clientToken.slice(-6)}`
                  : "No token stored in this browser."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowClientToken((value) => !value)}
                  disabled={!clientToken}
                  className="inline-flex min-h-10 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showClientToken ? "Hide token" : "Show token"}
                </button>
                <button
                  type="button"
                  onClick={() => void copyText("Client token", clientToken)}
                  disabled={!clientToken}
                  className="inline-flex min-h-10 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copy token
                </button>
              </div>
            </div>
          </div>
          <pre className="mt-5 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-200">
            {`authorization: Bearer ${clientToken ? "$TAKU_CLIENT_TOKEN" : "<generate-token-first>"}
x-taku-client-id: ${clientId ?? "<client-id>"}`}
          </pre>
          {credentialStatus ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
              {credentialStatus}
            </p>
          ) : null}
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Assistants
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Open one to edit and test completions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadAssistants()}
                disabled={loadingAssistants}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingAssistants ? "Loading" : "Reload"}
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              {assistants.length ? (
                assistants.map((assistant) => (
                  <a
                    key={assistant.id}
                    href={`/admin/assistants/${encodeURIComponent(
                      assistant.id,
                    )}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-950"
                  >
                    <span className="block text-sm font-semibold text-slate-950">
                      {assistant.name}
                    </span>
                    <span className="mt-1 block break-all text-xs text-slate-500">
                      {assistant.id}
                    </span>
                    <span className="mt-2 block text-xs text-slate-500">
                      Updated {new Date(assistant.updatedAt).toLocaleString()}
                    </span>
                  </a>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                  No assistants yet.
                </div>
              )}
            </div>
          </section>

          <form
            onSubmit={saveAssistant}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5"
          >
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Create assistant
              </p>
              <p className="mt-1 text-sm text-slate-500">
                After creation, the assistant page opens automatically.
              </p>
            </div>
            <label className="mt-5 block">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <label className="mt-5 block">
              <span className="text-sm font-medium text-slate-700">
                Instructions
              </span>
              <textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                className="mt-2 min-h-64 w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            {assistantStatus ? (
              <p className="mt-3 text-sm text-slate-600">{assistantStatus}</p>
            ) : null}
            <button
              type="submit"
              disabled={savingAssistant || !name.trim() || !instructions.trim()}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {savingAssistant ? "Saving" : "Create assistant"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
