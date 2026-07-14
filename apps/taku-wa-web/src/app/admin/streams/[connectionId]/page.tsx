"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SessionStorageValue = {
  sessionToken?: string;
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

type StreamMessage = {
  id: string;
  phone: string;
  text: string;
  direction: "inbound" | "outbound";
  timestamp: string;
};

type ConnectionsResponse =
  | { ok: true; connections: Connection[] }
  | { ok: false; error: string };

type ConnectionMessagesResponse =
  | {
      ok: true;
      connectionId: string;
      messages: StreamMessage[];
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
      restricted: boolean;
    }
  | { ok: false; error: string };

type StreamState = {
  messages: StreamMessage[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  restricted: boolean;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_API_BASE_URL ?? "http://localhost:3001";

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

function statusLabel(connection: Connection | null): string {
  if (!connection) {
    return "Loading";
  }

  if (connection.connected) {
    return "Connected";
  }

  if (connection.hasQr) {
    return "Waiting for scan";
  }

  return connection.state;
}

export default function StreamPage({
  params,
}: {
  params: { connectionId: string };
}) {
  const connectionId = decodeURIComponent(params.connectionId);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [stream, setStream] = useState<StreamState>({
    messages: [],
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
    restricted: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => connection?.label ?? connection?.phone ?? connectionId,
    [connection, connectionId],
  );

  const apiFetch = useCallback(async function apiFetch<T>(
    path: string,
    token: string,
  ): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        "content-type": "application/json",
        "x-session-token": token,
      },
    });
    const payload = (await response.json()) as T;
    if (!response.ok) {
      const maybeError = payload as { error?: string };
      throw new Error(maybeError.error ?? "Request failed");
    }

    return payload;
  }, []);

  const loadConnection = useCallback(
    async function loadConnection(token: string) {
      const payload = await apiFetch<ConnectionsResponse>(
        "/v1/account/connections",
        token,
      );
      if (!payload.ok) {
        throw new Error(payload.error);
      }

      const selectedConnection =
        payload.connections.find(
          (candidate) => candidate.connectionId === connectionId,
        ) ?? null;
      if (!selectedConnection) {
        throw new Error("Phone was not found for this account");
      }

      setConnection(selectedConnection);
    },
    [apiFetch, connectionId],
  );

  const loadStream = useCallback(
    async function loadStream(
      token: string,
      options?: { offset?: number; append?: boolean },
    ) {
      const offset = options?.offset ?? 0;
      const payload = await apiFetch<ConnectionMessagesResponse>(
        `/v1/account/connections/${encodeURIComponent(
          connectionId,
        )}/messages?limit=20&offset=${offset}`,
        token,
      );
      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setStream((current) => ({
        messages: options?.append
          ? [
              ...current.messages,
              ...payload.messages.filter(
                (message) =>
                  !current.messages.some(
                    (currentMessage) => currentMessage.id === message.id,
                  ),
              ),
            ]
          : [
              ...payload.messages,
              ...current.messages.filter(
                (message) =>
                  !payload.messages.some(
                    (payloadMessage) => payloadMessage.id === message.id,
                  ),
              ),
            ].slice(0, Math.max(payload.limit, current.messages.length)),
        total: payload.total,
        limit: payload.limit,
        offset: payload.offset,
        hasMore: payload.hasMore,
        restricted: payload.restricted,
      }));
    },
    [apiFetch, connectionId],
  );

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

    setIsLoading(true);
    setError(null);
    Promise.all([loadConnection(sessionToken), loadStream(sessionToken)])
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load live stream",
        );
      })
      .finally(() => setIsLoading(false));
  }, [loadConnection, loadStream, sessionToken]);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }

    let isCancelled = false;
    const intervalId = window.setInterval(() => {
      if (isCancelled) {
        return;
      }

      void loadStream(sessionToken).catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not refresh live stream",
        );
      });
    }, 5000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [loadStream, sessionToken]);

  function loadMore() {
    if (!sessionToken) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);
    void loadStream(sessionToken, {
      offset: stream.offset + stream.limit,
      append: true,
    })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load more messages",
        );
      })
      .finally(() => setIsLoadingMore(false));
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU
        </a>
        <a
          href="/admin"
          className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
        >
          Back to admin
        </a>
      </nav>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Live stream
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 md:text-5xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Inbound WhatsApp messages refresh every 5 seconds.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${
                connection?.connected
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {statusLabel(connection)}
            </span>
            <span className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 font-mono text-xs font-semibold text-slate-700">
              {connectionId}
            </span>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Messages shown
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {stream.messages.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Total inbound
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {stream.total}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Access
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {stream.restricted ? "Free" : "Full"}
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Inbound messages
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {stream.restricted
                  ? "Free accounts show the latest 20 inbound messages."
                  : "Paid accounts can page through the full inbound history."}
              </p>
            </div>
            {isLoading ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Loading
              </span>
            ) : null}
          </div>

          <div className="mt-6 grid gap-3">
            {isLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Loading messages...
              </div>
            ) : null}

            {!isLoading && stream.messages.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No inbound messages yet.
              </div>
            ) : null}

            {stream.messages.map((message) => (
              <article
                key={`${message.phone}-${message.id}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-mono text-xs font-semibold text-slate-950">
                    {message.phone}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(message.timestamp).toLocaleString()}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {message.text}
                </p>
              </article>
            ))}
          </div>

          {stream.hasMore ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </section>
      </section>
    </main>
  );
}
