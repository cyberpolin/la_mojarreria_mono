"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SessionStorageValue = {
  sessionToken?: string;
};

type UsageDay = {
  date: string;
  messagesSent: number;
  updatedAt: string | null;
};

type MonthlyUsageResponse =
  | {
      ok: true;
      month: string;
      from: string;
      to: string;
      usageDays: UsageDay[];
      totalMessages: number;
    }
  | { ok: false; error: string };

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

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return new Date(Number(year), Number(monthNumber) - 1, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );
}

export default function AdminUsagePage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [usageDays, setUsageDays] = useState<UsageDay[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const maxMessages = useMemo(
    () =>
      usageDays.reduce((max, usage) => Math.max(max, usage.messagesSent), 0),
    [usageDays],
  );

  const activeDays = useMemo(
    () => usageDays.filter((usage) => usage.messagesSent > 0).length,
    [usageDays],
  );

  const averageMessages = useMemo(() => {
    if (usageDays.length === 0) {
      return 0;
    }

    return Math.round(totalMessages / usageDays.length);
  }, [totalMessages, usageDays.length]);

  const loadUsage = useCallback(async function loadUsage(
    token: string,
    selectedMonth: string,
  ) {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBaseUrl}/v1/account/usage/monthly?month=${encodeURIComponent(
          selectedMonth,
        )}`,
        {
          headers: {
            "content-type": "application/json",
            "x-session-token": token,
          },
        },
      );
      const payload = (await response.json()) as MonthlyUsageResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "Could not load usage" : payload.error);
      }

      setMonth(payload.month);
      setUsageDays(payload.usageDays);
      setTotalMessages(payload.totalMessages);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load usage",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = loadSessionToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setSessionToken(token);
    void loadUsage(token, month);
  }, [loadUsage, month]);

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
              Usage graphs
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950 md:text-5xl">
              Monthly messages
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Simple daily message usage for {formatMonth(month)}.
            </p>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-slate-950"
            />
          </label>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Total messages
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {totalMessages}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Active days
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {activeDays}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Daily average
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {averageMessages}
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Daily messages
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Each bar is one day of the selected month.
              </p>
            </div>
            {isLoading ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Loading
              </span>
            ) : null}
          </div>

          <div className="mt-8 overflow-x-auto">
            <div className="flex min-w-[760px] items-end gap-2 border-b border-slate-200 pb-3">
              {usageDays.map((usage) => {
                const height =
                  maxMessages === 0
                    ? 4
                    : Math.max(8, (usage.messagesSent / maxMessages) * 180);
                const day = Number(usage.date.slice(-2));

                return (
                  <div
                    key={usage.date}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex h-48 w-full items-end justify-center">
                      <div
                        className="w-full max-w-5 rounded-t-md bg-emerald-600"
                        style={{ height }}
                        title={`${usage.date}: ${usage.messagesSent} messages`}
                      />
                    </div>
                    <p className="text-xs font-semibold text-slate-500">
                      {day}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {!isLoading && totalMessages === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No messages sent in this month yet.
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
