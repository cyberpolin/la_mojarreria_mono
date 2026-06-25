"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  name: string;
  email: string;
  projectName: string;
  plan: string;
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
};

type MeResponse =
  | {
      ok: true;
      account: Account;
      entitlements: Entitlements;
      usage: Usage;
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

function statusLabel(connection: Connection): string {
  if (connection.connected) {
    return "Connected";
  }

  if (connection.hasQr) {
    return "Waiting for scan";
  }

  return connection.state;
}

export default function AdminPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
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
      const [mePayload, connectionsPayload] = await Promise.all([
        apiFetch<MeResponse>("/v1/account/me"),
        apiFetch<ConnectionsResponse>("/v1/account/connections"),
      ]);

      if (!mePayload.ok) {
        throw new Error(mePayload.error);
      }

      if (!connectionsPayload.ok) {
        throw new Error(connectionsPayload.error);
      }

      setAccount(mePayload.account);
      setEntitlements(mePayload.entitlements);
      setUsage(mePayload.usage);
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

  useEffect(() => {
    const token = loadSessionToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setSessionToken(token);
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

  function logout() {
    window.localStorage.removeItem("TAKU_WA_SIGNUP_RESULT");
    window.location.href = "/login";
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
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 md:text-5xl">
              {account?.projectName ?? "WhatsApp phones"}
            </h1>
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
