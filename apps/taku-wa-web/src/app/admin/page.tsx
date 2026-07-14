"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  name: string;
  email: string;
  projectName: string;
  plan: string;
  isSuperowner?: boolean;
  connectionIds: string[];
};

type Entitlements = {
  connectionLimit: number | null;
  dailyMessageLimit: number | null;
  webhooksEnabled: boolean;
};

type Usage = {
  date: string;
  messagesSent: number;
};

type Connection = {
  connectionId: string;
  businessId: string | null;
  label: string | null;
  active: boolean;
  connected: boolean;
  connection: string;
  hasQr: boolean;
  phone: string | null;
  state: string;
  lastChangedAt: string;
};

type SessionStorageValue = {
  sessionToken?: string;
  apiKey?: string;
};

type MeResponse =
  | {
      ok: true;
      account: Account;
      entitlements: Entitlements;
      usage: Usage;
    }
  | { ok: false; error: string };

type AccountUpdateResponse = MeResponse;

type ApiKeyResponse =
  | {
      ok: true;
      account: Account;
      apiKey: string;
      apiKeyNotice: string;
    }
  | { ok: false; error: string };

type ConnectionsResponse =
  | { ok: true; connections: Connection[] }
  | { ok: false; error: string };

type QrResponse =
  | { ok: true; qrImage: string | null; connection: Connection }
  | { ok: false; error: string };

type StatusResponse =
  | { ok: true; connection: Connection }
  | { ok: false; error: string };

type AddConnectionResponse =
  | {
      ok: true;
      account: Account;
      connection: Connection;
      qrImage: string | null;
    }
  | {
      ok: false;
      error: string;
      upgradeRequired?: boolean;
      entitlements?: Entitlements;
    };

type AdminAccountSummary = {
  id: string;
  name: string;
  email: string;
  projectName: string;
  plan: string;
  connectionCount: number;
  connectionIds: string[];
  messagesToday: number;
  messagesThisMonth: number;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  openInvoiceCount: number;
  passwordSetupRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

type AdminOverview = {
  totalAccounts: number;
  totalConnections: number;
  planCounts: Record<string, number>;
  phoneHealth: {
    total: number;
    connected: number;
    qrPending: number;
    errors: number;
    inactive: number;
    unknown: number;
  };
  billing: {
    activeSubscriptions: number;
    pastDueSubscriptions: number;
    cancelledSubscriptions: number;
    openInvoices: number;
    paidInvoices: number;
    revenueThisMonthUsd: number;
    nextDue: Array<{
      accountId: string;
      projectName: string;
      plan: string;
      currentPeriodEnd: string;
    }>;
  };
  usage: {
    messagesToday: number;
    messagesThisMonth: number;
    topAccounts: Array<{
      accountId: string;
      projectName: string;
      messagesThisMonth: number;
    }>;
  };
  support: {
    passwordSetupRequired: number;
    accountsWithoutPhones: number;
    pendingBillingRequests: number;
    pendingPaymentIntents: number;
  };
  accounts: AdminAccountSummary[];
};

type AdminOverviewResponse =
  | { ok: true; overview: AdminOverview }
  | { ok: false; error: string };

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_API_BASE_URL ?? "http://localhost:3001";

const apiKeyPlaceholder = "taku_wa_your_api_key";

function loadSessionToken(): string | null {
  try {
    const raw = window.localStorage.getItem("TAKU_WA_SIGNUP_RESULT");
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SessionStorageValue;
    return parsed.sessionToken ?? null;
  } catch {
    return null;
  }
}

function loadStoredApiKey(): string | null {
  try {
    const raw = window.localStorage.getItem("TAKU_WA_SIGNUP_RESULT");
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SessionStorageValue;
    return parsed.apiKey && parsed.apiKey.length > 0 ? parsed.apiKey : null;
  } catch {
    return null;
  }
}

function maskApiKey(apiKey: string | null): string {
  if (!apiKey) {
    return "XXXXX-XXXXX-XXXXX";
  }

  return `${apiKey.slice(0, 8)}_${"X".repeat(20)}`;
}

function statusLabel(connection: Connection): string {
  if (connection.connected) {
    return "Connected";
  }

  if (connection.hasQr) {
    return "Waiting for scan";
  }

  return connection.state;
}

function syncStoredAccount(account: Account): void {
  try {
    const raw = window.localStorage.getItem("TAKU_WA_SIGNUP_RESULT");
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    window.localStorage.setItem(
      "TAKU_WA_SIGNUP_RESULT",
      JSON.stringify({ ...parsed, account }),
    );
  } catch {
    // Local storage is only a convenience cache for this page.
  }
}

function numberText(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function dateText(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

export default function AdminPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(
    null,
  );
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [loadingQrIds, setLoadingQrIds] = useState<Record<string, boolean>>({});
  const [autoQrRequestedIds, setAutoQrRequestedIds] = useState<
    Record<string, boolean>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [storedApiKey, setStoredApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [isCreatingApiKey, setIsCreatingApiKey] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [isSavingProjectName, setIsSavingProjectName] = useState(false);

  const connectionLimitText = useMemo(() => {
    if (!entitlements) {
      return "-";
    }

    return entitlements.connectionLimit === null
      ? "Unlimited"
      : String(entitlements.connectionLimit);
  }, [entitlements]);

  const primaryPhoneAction = useMemo(() => {
    const hasUnpairedConnection = connections.some(
      (connection) => !connection.connected,
    );
    return hasUnpairedConnection ? "Pair phone" : "Add phone";
  }, [connections]);

  const docsConnectionId = useMemo(
    () =>
      connections.find((connection) => connection.connected)?.connectionId ??
      connections[0]?.connectionId ??
      "wa_your_connection_id",
    [connections],
  );

  const sendMessageExample = useMemo(
    () => `curl -X POST ${apiBaseUrl}/v1/account/connections/${docsConnectionId}/messages \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${apiKeyPlaceholder}" \\
  -d '{
    "to": "5219931234567",
    "text": "Your order is ready."
  }'`,
    [docsConnectionId],
  );

  const webhookExample = useMemo(
    () => `curl -X POST ${apiBaseUrl}/v1/account/webhooks/subscriptions \\
  -H "content-type: application/json" \\
  -H "x-api-key: ${apiKeyPlaceholder}" \\
  -d '{
    "url": "https://your-app.com/webhooks/taku-wa",
    "events": ["message.received", "connection.updated"],
    "connectionIds": ["${docsConnectionId}"]
  }'`,
    [docsConnectionId],
  );

  const unpairedConnections = useMemo(
    () => connections.filter((connection) => !connection.connected),
    [connections],
  );

  const pairingConnectionIds = useMemo(
    () =>
      unpairedConnections
        .filter(
          (connection) =>
            connection.hasQr ||
            Boolean(qrImages[connection.connectionId]) ||
            Boolean(loadingQrIds[connection.connectionId]),
        )
        .map((connection) => connection.connectionId),
    [loadingQrIds, qrImages, unpairedConnections],
  );

  const pairingConnectionIdsKey = useMemo(
    () => pairingConnectionIds.join("|"),
    [pairingConnectionIds],
  );

  const apiFetch = useCallback(
    async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
      if (!sessionToken) {
        throw new Error("Missing session");
      }

      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          "x-session-token": sessionToken,
          ...(init?.headers ?? {}),
        },
      });
      const payload = (await response.json()) as T;
      if (!response.ok) {
        const maybeError = payload as { error?: string };
        throw new Error(maybeError.error ?? "Request failed");
      }

      return payload;
    },
    [sessionToken],
  );

  const refreshDashboard = useCallback(
    async function refreshDashboard() {
      if (!sessionToken) {
        return;
      }

      setError(null);
      const mePayload = await apiFetch<MeResponse>("/v1/account/me");

      if (!mePayload.ok) {
        throw new Error(mePayload.error);
      }

      setAccount(mePayload.account);
      setEntitlements(mePayload.entitlements);
      setUsage(mePayload.usage);

      if (mePayload.account.isSuperowner) {
        const overviewPayload = await apiFetch<AdminOverviewResponse>(
          "/v1/account/admin/overview",
        );

        if (!overviewPayload.ok) {
          throw new Error(overviewPayload.error);
        }

        setAdminOverview(overviewPayload.overview);
        setConnections([]);
        return;
      }

      setAdminOverview(null);
      const connectionsPayload = await apiFetch<ConnectionsResponse>(
        "/v1/account/connections",
      );

      if (!connectionsPayload.ok) {
        throw new Error(connectionsPayload.error);
      }

      setConnections(connectionsPayload.connections);
    },
    [apiFetch, sessionToken],
  );

  const refreshQr = useCallback(
    async function refreshQr(connectionId: string) {
      setLoadingQrIds((current) => ({ ...current, [connectionId]: true }));
      setNotice("Refreshing QR...");
      try {
        const payload = await apiFetch<QrResponse>(
          `/v1/account/connections/${encodeURIComponent(connectionId)}/qr`,
        );
        if (!payload.ok) {
          throw new Error(payload.error);
        }

        if (payload.qrImage) {
          const qrImage = payload.qrImage;
          setQrImages((current) => ({
            ...current,
            [connectionId]: qrImage,
          }));
          setNotice("QR ready.");
        } else {
          setNotice("QR is not ready yet. Try refreshing in a moment.");
        }
        await refreshDashboard();
      } finally {
        setLoadingQrIds((current) => ({ ...current, [connectionId]: false }));
      }
    },
    [apiFetch, refreshDashboard],
  );

  async function addPhone() {
    if (!entitlements) {
      return;
    }

    if (
      entitlements.connectionLimit !== null &&
      connections.length >= entitlements.connectionLimit
    ) {
      const unpairedConnection = connections.find(
        (connection) => !connection.connected,
      );
      if (unpairedConnection) {
        await refreshQr(unpairedConnection.connectionId);
        return;
      }

      setShowPayModal(true);
      return;
    }

    setIsAdding(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await apiFetch<AddConnectionResponse>(
        "/v1/account/connections",
        {
          method: "POST",
          body: JSON.stringify({ label: account?.projectName ?? "WhatsApp" }),
        },
      );

      if (!payload.ok) {
        if (payload.upgradeRequired) {
          setShowPayModal(true);
          return;
        }

        throw new Error(payload.error);
      }

      setAccount(payload.account);
      setConnections((current) => [...current, payload.connection]);
      if (payload.qrImage) {
        const qrImage = payload.qrImage;
        setQrImages((current) => ({
          ...current,
          [payload.connection.connectionId]: qrImage,
        }));
      }
      setNotice("Phone created. Scan the QR to pair it.");
      await refreshDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not add phone",
      );
    } finally {
      setIsAdding(false);
    }
  }

  async function saveProjectName() {
    const projectName = projectNameDraft.trim();
    if (!projectName) {
      setError("Project name is required");
      return;
    }

    setIsSavingProjectName(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await apiFetch<AccountUpdateResponse>("/v1/account/me", {
        method: "PATCH",
        body: JSON.stringify({ projectName }),
      });

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setAccount(payload.account);
      setEntitlements(payload.entitlements);
      setUsage(payload.usage);
      syncStoredAccount(payload.account);
      setIsEditingProjectName(false);
      setNotice("Project name updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update project name",
      );
    } finally {
      setIsSavingProjectName(false);
    }
  }

  useEffect(() => {
    const token = loadSessionToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setSessionToken(token);
    setStoredApiKey(loadStoredApiKey());
  }, []);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }

    refreshDashboard()
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load dashboard",
        );
      })
      .finally(() => setIsLoading(false));
  }, [refreshDashboard, sessionToken]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    for (const connection of unpairedConnections) {
      if (
        qrImages[connection.connectionId] ||
        loadingQrIds[connection.connectionId] ||
        autoQrRequestedIds[connection.connectionId]
      ) {
        continue;
      }

      setAutoQrRequestedIds((current) => ({
        ...current,
        [connection.connectionId]: true,
      }));
      void refreshQr(connection.connectionId).catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load pairing QR",
        );
      });
    }
  }, [
    autoQrRequestedIds,
    isLoading,
    loadingQrIds,
    qrImages,
    refreshQr,
    unpairedConnections,
  ]);

  useEffect(() => {
    if (!sessionToken || !pairingConnectionIdsKey) {
      return;
    }

    let isCancelled = false;

    async function pollPairingStatus() {
      const connectionIds = pairingConnectionIdsKey.split("|").filter(Boolean);
      const statuses = await Promise.all(
        connectionIds.map(async (connectionId) => {
          try {
            const payload = await apiFetch<StatusResponse>(
              `/v1/account/connections/${encodeURIComponent(
                connectionId,
              )}/status`,
            );
            return payload.ok ? payload.connection : null;
          } catch {
            return null;
          }
        }),
      );

      if (isCancelled) {
        return;
      }

      const latestConnections = statuses.filter(
        (connection): connection is Connection => connection !== null,
      );
      if (latestConnections.length === 0) {
        return;
      }

      const connectedIds = latestConnections
        .filter((connection) => connection.connected)
        .map((connection) => connection.connectionId);

      setConnections((current) =>
        current.map((connection) => {
          const latestConnection = latestConnections.find(
            (candidate) => candidate.connectionId === connection.connectionId,
          );
          return latestConnection ?? connection;
        }),
      );

      if (connectedIds.length === 0) {
        return;
      }

      setQrImages((current) => {
        const next = { ...current };
        for (const connectionId of connectedIds) {
          delete next[connectionId];
        }
        return next;
      });
      setNotice("Phone paired successfully.");
      void refreshDashboard().catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not refresh paired phone",
        );
      });
    }

    void pollPairingStatus();
    const intervalId = window.setInterval(() => {
      void pollPairingStatus();
    }, 3000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [apiFetch, pairingConnectionIdsKey, refreshDashboard, sessionToken]);

  useEffect(() => {
    if (!isEditingProjectName) {
      setProjectNameDraft(account?.projectName ?? "");
    }
  }, [account?.projectName, isEditingProjectName]);

  function logout() {
    window.localStorage.removeItem("TAKU_WA_SIGNUP_RESULT");
    window.location.href = "/login";
  }

  async function copyApiKey() {
    if (!storedApiKey) {
      return;
    }

    await window.navigator.clipboard.writeText(storedApiKey);
    setApiKeyCopied(true);
    window.setTimeout(() => setApiKeyCopied(false), 1600);
  }

  async function createApiKey() {
    setIsCreatingApiKey(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await apiFetch<ApiKeyResponse>("/v1/account/api-key", {
        method: "POST",
      });

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setAccount(payload.account);
      syncStoredAccount(payload.account);
      setStoredApiKey(payload.apiKey);
      setShowApiKey(true);
      setNotice("New API key created. Store it now.");

      const raw = window.localStorage.getItem("TAKU_WA_SIGNUP_RESULT");
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      window.localStorage.setItem(
        "TAKU_WA_SIGNUP_RESULT",
        JSON.stringify({
          ...parsed,
          account: payload.account,
          apiKey: payload.apiKey,
        }),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create API key",
      );
    } finally {
      setIsCreatingApiKey(false);
    }
  }

  if (account?.isSuperowner) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
          <a href="/" className="text-sm font-bold tracking-[0.2em]">
            TAKU
          </a>
          <button
            type="button"
            onClick={logout}
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Log out
          </button>
        </nav>

        <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              TAKU WA Superowner
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 md:text-5xl">
              Platform dashboard
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Manage standalone TAKU WA accounts, plans, and phone capacity.
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              {notice}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Accounts
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">
                {adminOverview?.totalAccounts ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Phones
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">
                {adminOverview?.totalConnections ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Paid
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">
                {["basic", "developer", "platform", "enterprise"].reduce(
                  (total, plan) =>
                    total + (adminOverview?.planCounts[plan] ?? 0),
                  0,
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Free
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">
                {adminOverview?.planCounts.free ?? 0}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                1. Platform overview
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Plan mix
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {["free", "basic", "developer", "platform", "enterprise"].map(
                  (plan) => (
                    <div
                      key={plan}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-xs font-semibold capitalize text-slate-500">
                        {plan}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">
                        {adminOverview?.planCounts[plan] ?? 0}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                2. Phone health
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Connection states
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ["Connected", adminOverview?.phoneHealth.connected ?? 0],
                  ["QR pending", adminOverview?.phoneHealth.qrPending ?? 0],
                  ["Errors", adminOverview?.phoneHealth.errors ?? 0],
                  ["Inactive", adminOverview?.phoneHealth.inactive ?? 0],
                  ["Unknown", adminOverview?.phoneHealth.unknown ?? 0],
                  ["Total", adminOverview?.phoneHealth.total ?? 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-xs font-semibold text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                3. Billing
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Revenue and due dates
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  [
                    "MRR paid",
                    `$${adminOverview?.billing.revenueThisMonthUsd ?? 0}`,
                  ],
                  ["Active", adminOverview?.billing.activeSubscriptions ?? 0],
                  [
                    "Past due",
                    adminOverview?.billing.pastDueSubscriptions ?? 0,
                  ],
                  [
                    "Cancelled",
                    adminOverview?.billing.cancelledSubscriptions ?? 0,
                  ],
                  ["Open invoices", adminOverview?.billing.openInvoices ?? 0],
                  ["Paid invoices", adminOverview?.billing.paidInvoices ?? 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-xs font-semibold text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-2">
                {(adminOverview?.billing.nextDue ?? []).map((item) => (
                  <div
                    key={`${item.accountId}-${item.currentPeriodEnd}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-950">
                      {item.projectName}
                    </span>
                    <span className="text-slate-600">
                      {dateText(item.currentPeriodEnd)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                4. Usage
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Message volume
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Today</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {numberText(adminOverview?.usage.messagesToday ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">
                    This month
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {numberText(adminOverview?.usage.messagesThisMonth ?? 0)}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-2">
                {(adminOverview?.usage.topAccounts ?? []).map((item) => (
                  <div
                    key={item.accountId}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-950">
                      {item.projectName}
                    </span>
                    <span className="text-slate-600">
                      {numberText(item.messagesThisMonth)} messages
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                5. Support queue
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Accounts needing attention
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                  [
                    "No phones",
                    adminOverview?.support.accountsWithoutPhones ?? 0,
                  ],
                  [
                    "Needs password",
                    adminOverview?.support.passwordSetupRequired ?? 0,
                  ],
                  [
                    "Billing pending",
                    adminOverview?.support.pendingBillingRequests ?? 0,
                  ],
                  [
                    "Payment intents",
                    adminOverview?.support.pendingPaymentIntents ?? 0,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-xs font-semibold text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Accounts
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Standalone customers
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void refreshDashboard()}
                disabled={isLoading}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {isLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Loading accounts...
                </div>
              ) : null}

              {!isLoading && adminOverview?.accounts.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No standalone accounts yet.
                </div>
              ) : null}

              {adminOverview?.accounts.map((customer) => (
                <article
                  key={customer.id}
                  className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">
                        {customer.projectName}
                      </h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                        {customer.plan}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                        {customer.subscriptionStatus}
                      </span>
                      {customer.passwordSetupRequired ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          Needs password
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {customer.name} · {customer.email}
                    </p>
                    <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
                      <div>
                        <dt className="font-semibold text-slate-950">Today</dt>
                        <dd>{numberText(customer.messagesToday)} messages</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-950">Month</dt>
                        <dd>
                          {numberText(customer.messagesThisMonth)} messages
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-950">Due</dt>
                        <dd>{dateText(customer.currentPeriodEnd)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-950">
                          Open invoices
                        </dt>
                        <dd>{customer.openInvoiceCount}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="text-sm text-slate-600 md:text-right">
                    <p className="font-semibold text-slate-950">
                      {customer.connectionCount} phones
                    </p>
                    <p className="mt-1">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU
        </a>
        <button
          type="button"
          onClick={logout}
          className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
        >
          Log out
        </button>
      </nav>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              TAKU WA Admin
            </p>
            {isEditingProjectName ? (
              <form
                className="mt-3 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveProjectName();
                }}
              >
                <input
                  value={projectNameDraft}
                  onChange={(event) => setProjectNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setProjectNameDraft(account?.projectName ?? "");
                      setIsEditingProjectName(false);
                    }
                  }}
                  disabled={isSavingProjectName}
                  autoFocus
                  className="min-h-11 flex-1 rounded-2xl border border-slate-300 bg-white px-4 text-2xl font-semibold text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 md:text-4xl"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSavingProjectName}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSavingProjectName ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingProjectName}
                    onClick={() => {
                      setProjectNameDraft(account?.projectName ?? "");
                      setIsEditingProjectName(false);
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="group mt-3 flex items-center gap-2">
                <h1 className="text-3xl font-semibold text-slate-950 md:text-5xl">
                  {account?.projectName ?? "WhatsApp phones"}
                </h1>
                {account ? (
                  <button
                    type="button"
                    aria-label="Edit project name"
                    onClick={() => {
                      setProjectNameDraft(account.projectName);
                      setIsEditingProjectName(true);
                    }}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 opacity-0 transition hover:border-slate-950 hover:text-slate-950 focus:opacity-100 focus:outline-none focus:ring-4 focus:ring-emerald-100 group-hover:opacity-100"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    >
                      <path d="M12 20h9" />
                      <path d="m16.5 3.5 4 4L7 21l-4 1 1-4 12.5-14.5Z" />
                    </svg>
                  </button>
                ) : null}
              </div>
            )}
            <p className="mt-3 text-sm text-slate-600">
              Manage paired phones and connection status.
            </p>
          </div>
          <button
            type="button"
            disabled={isAdding || isLoading}
            onClick={() => void addPhone()}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isAdding ? "Adding..." : primaryPhoneAction}
          </button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Plan
            </p>
            <p className="mt-3 text-2xl font-semibold capitalize text-slate-950">
              {account?.plan ?? "-"}
            </p>
            <a
              href="/admin/billing"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 hover:border-emerald-600 hover:text-emerald-800"
            >
              Upgrade account
            </a>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Phones
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {connections.length} / {connectionLimitText}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Messages today
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {usage?.messagesSent ?? 0}
            </p>
            <a
              href="/admin/usage"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
            >
              View graphs
            </a>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {notice}
          </div>
        ) : null}

        {!isLoading && unpairedConnections.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">
              Pair your WhatsApp phone
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Your account is ready, but no phone is paired yet. Scan the QR
              below from WhatsApp linked devices. After the scan completes, this
              page will show the phone as connected and the API can send
              messages through it.
            </p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-4">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Loading phones...
            </div>
          ) : null}

          {!isLoading && connections.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No phones yet.
            </div>
          ) : null}

          {connections.map((connection) => (
            <article
              key={connection.connectionId}
              className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-[1fr_auto]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {connection.label ?? connection.connectionId}
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      connection.connected
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {statusLabel(connection)}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-950">
                      Connection ID
                    </dt>
                    <dd className="mt-1 font-mono text-xs">
                      {connection.connectionId}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-950">Phone</dt>
                    <dd className="mt-1">{connection.phone ?? "Not paired"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-950">State</dt>
                    <dd className="mt-1">{connection.state}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-950">Updated</dt>
                    <dd className="mt-1">
                      {new Date(connection.lastChangedAt).toLocaleString()}
                    </dd>
                  </div>
                </dl>
                {!connection.connected ? (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">
                      Scan to pair
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Open WhatsApp, go to Linked devices, then scan this QR.
                    </p>
                    {qrImages[connection.connectionId] ? (
                      <Image
                        src={qrImages[connection.connectionId]}
                        alt="WhatsApp pairing QR"
                        width={320}
                        height={320}
                        unoptimized
                        className="mt-4 aspect-square w-full max-w-xs rounded-xl border border-slate-200 bg-white"
                      />
                    ) : (
                      <div className="mt-4 grid aspect-square w-full max-w-xs place-items-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                        {loadingQrIds[connection.connectionId]
                          ? "Generating QR..."
                          : "QR will appear here."}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3 md:flex-col">
                <button
                  type="button"
                  onClick={() => void refreshDashboard()}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
                >
                  Refresh
                </button>
                {!connection.connected ? (
                  <button
                    type="button"
                    onClick={() => void refreshQr(connection.connectionId)}
                    disabled={loadingQrIds[connection.connectionId]}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {loadingQrIds[connection.connectionId]
                      ? "Loading QR..."
                      : "Refresh QR"}
                  </button>
                ) : null}
                <a
                  href={`/admin/streams/${encodeURIComponent(
                    connection.connectionId,
                  )}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Open stream
                </a>
              </div>
            </article>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                API key
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                Server token
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Use this token as the <code>x-api-key</code> header from your
                backend. Keep it private.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!storedApiKey && isCreatingApiKey}
                onClick={() =>
                  storedApiKey
                    ? setShowApiKey((current) => !current)
                    : void createApiKey()
                }
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {storedApiKey
                  ? showApiKey
                    ? "Hide"
                    : "Show"
                  : isCreatingApiKey
                    ? "Creating..."
                    : "Create key"}
              </button>
              <button
                type="button"
                disabled={!storedApiKey}
                onClick={() => void copyApiKey()}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {apiKeyCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <code className="break-all font-mono text-sm text-slate-950">
              {showApiKey && storedApiKey
                ? storedApiKey
                : maskApiKey(storedApiKey)}
            </code>
            {!storedApiKey ? (
              <p className="mt-3 text-sm text-slate-600">
                The original key was only returned at account creation. Create a
                new key here to view and copy it.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                API docs
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Build with your WhatsApp connection
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Use your account API key for server-to-server requests. Keep it
                private and send it as the <code>x-api-key</code> header.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
              Base URL: <span className="font-mono">{apiBaseUrl}</span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Account and phones
              </p>
              <dl className="mt-4 grid gap-3 text-sm text-slate-600">
                <div>
                  <dt className="font-mono text-xs font-semibold text-slate-950">
                    GET /v1/account/me
                  </dt>
                  <dd className="mt-1">Read plan limits and daily usage.</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs font-semibold text-slate-950">
                    GET /v1/account/connections
                  </dt>
                  <dd className="mt-1">List paired and pending phones.</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs font-semibold text-slate-950">
                    GET /v1/account/connections/:id/qr
                  </dt>
                  <dd className="mt-1">Get the QR image for phone pairing.</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs font-semibold text-slate-950">
                    GET /v1/account/connections/:id/status
                  </dt>
                  <dd className="mt-1">Check if a phone is connected.</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Send a message
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                <code>{sendMessageExample}</code>
              </pre>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
              <p className="text-sm font-semibold text-slate-950">
                Subscribe to webhooks
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Receive inbound messages and connection lifecycle events in your
                own application.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                <code>{webhookExample}</code>
              </pre>
            </div>
          </div>
        </section>
      </section>

      {showPayModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Upgrade
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">
              Free includes one phone
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Add more WhatsApp phones by upgrading to a paid plan.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/admin/billing"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                View billing
              </a>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:border-slate-950"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
