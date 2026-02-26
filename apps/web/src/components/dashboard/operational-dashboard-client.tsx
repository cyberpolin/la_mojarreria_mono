"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  DashboardPayload,
  DashboardAlert,
  DashboardActionable,
  DailyCloseItemMetric,
} from "@/types/dashboard";
import { MetricCard } from "@/components/ui/card";
import { buildDashboardMetrics } from "@/lib/dashboard-metrics";
import {
  AlertThresholds,
  DEFAULT_ALERT_THRESHOLDS,
  generateAlerts,
} from "@/lib/alerts-engine";
import {
  generateActionables,
  getActionablesStorageKey,
} from "@/lib/actionables";

const CACHE_PREFIX = "MOJARRERIA_DASHBOARD_CACHE_";

const toMoney = (value: number) => `$${(value / 100).toFixed(2)}`;

const todayISO = () => new Date().toISOString().slice(0, 10);
const yesterdayISO = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

const actionColor: Record<DashboardAlert["severity"], string> = {
  info: "border-slate-700 bg-slate-900 text-slate-200",
  warn: "border-slate-600 bg-slate-800 text-slate-100",
  error: "border-slate-500 bg-slate-800 text-slate-50",
};

export function OperationalDashboardClient({
  initialDate,
}: {
  initialDate: string;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [doneActions, setDoneActions] = useState<Record<string, boolean>>({});
  const [thresholds, setThresholds] = useState<AlertThresholds>(
    DEFAULT_ALERT_THRESHOLDS,
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      setFromCache(false);
      try {
        const response = await fetch(
          `/api/operational-dashboard?date=${selectedDate}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(`Failed to load dashboard (${response.status})`);
        }
        const payload = (await response.json()) as DashboardPayload;
        if (cancelled) return;
        setData(payload);
        localStorage.setItem(
          `${CACHE_PREFIX}${selectedDate}`,
          JSON.stringify(payload),
        );
      } catch (err) {
        if (cancelled) return;
        const cache = localStorage.getItem(`${CACHE_PREFIX}${selectedDate}`);
        if (cache) {
          setData(JSON.parse(cache) as DashboardPayload);
          setFromCache(true);
          setError(
            err instanceof Error ? err.message : "Failed to load dashboard",
          );
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to load dashboard",
          );
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const metrics = useMemo(
    () =>
      buildDashboardMetrics(
        data?.close ?? null,
        data?.recentCloses ?? [],
        data?.baseline ?? [],
      ),
    [data],
  );

  const alerts = useMemo(() => {
    if (!data) return [];
    return generateAlerts({
      selectedDate,
      close: data.close,
      metrics,
      baseline: data.baseline,
      syncStatus: data.syncStatus,
      thresholds,
    });
  }, [data, metrics, selectedDate, thresholds]);

  const actionables = useMemo<DashboardActionable[]>(
    () => generateActionables(alerts),
    [alerts],
  );

  useEffect(() => {
    const key = getActionablesStorageKey(selectedDate);
    const raw = localStorage.getItem(key);
    setDoneActions(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
  }, [selectedDate]);

  const toggleDone = (id: string) => {
    setDoneActions((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(
        getActionablesStorageKey(selectedDate),
        JSON.stringify(next),
      );
      return next;
    });
  };

  const topProducts = useMemo<DailyCloseItemMetric[]>(
    () =>
      [...(data?.close?.items ?? [])]
        .sort((a, b) => b.subtotal - a.subtotal)
        .slice(0, 10),
    [data],
  );

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA OPERATIONS
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">
            Operational Dashboard
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedDate(todayISO())}
            className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 hover:bg-slate-800"
          >
            Today
          </button>
          <button
            onClick={() => setSelectedDate(yesterdayISO())}
            className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 hover:bg-slate-800"
          >
            Ayer
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          />
          <Link
            href="/weekly"
            className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700 inline-flex items-center"
          >
            Weekly
          </Link>
        </div>
      </header>

      {error ? (
        <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          <p className="font-medium text-slate-100">Data source issue</p>
          <p>{error}</p>
          {fromCache ? (
            <p className="mt-1 text-slate-300">
              Showing last cached snapshot for {selectedDate}.
            </p>
          ) : null}
        </section>
      ) : null}

      {loading ? (
        <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          Loading dashboard...
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="space-y-5">
          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold text-slate-100">
              Alert thresholds
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
              <label className="flex flex-col gap-1 text-slate-300">
                Descuadre threshold (cents)
                <input
                  type="number"
                  value={thresholds.descuadreThreshold}
                  onChange={(event) =>
                    setThresholds((prev) => ({
                      ...prev,
                      descuadreThreshold: Number(event.target.value) || 0,
                    }))
                  }
                  className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                Expense ratio
                <input
                  type="number"
                  step="0.05"
                  value={thresholds.expenseRatioThreshold}
                  onChange={(event) =>
                    setThresholds((prev) => ({
                      ...prev,
                      expenseRatioThreshold: Number(event.target.value) || 0,
                    }))
                  }
                  className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                Sync stale minutes
                <input
                  type="number"
                  value={thresholds.syncStaleMinutes}
                  onChange={(event) =>
                    setThresholds((prev) => ({
                      ...prev,
                      syncStaleMinutes: Number(event.target.value) || 0,
                    }))
                  }
                  className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                Product drop factor
                <input
                  type="number"
                  step="0.05"
                  value={thresholds.dropFactor}
                  onChange={(event) =>
                    setThresholds((prev) => ({
                      ...prev,
                      dropFactor: Number(event.target.value) || 0,
                    }))
                  }
                  className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-slate-100"
                />
              </label>
            </div>
          </article>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              title="Sales Total"
              value={toMoney(metrics.salesTotal)}
            />
            <MetricCard title="COGS" value={toMoney(metrics.cogsCents)} />
            <MetricCard
              title="Gross Profit"
              value={toMoney(metrics.grossProfitCents)}
            />
            <MetricCard
              title="Gross Margin"
              value={`${metrics.grossMarginPct.toFixed(2)}%`}
            />
            <MetricCard title="Money In" value={toMoney(metrics.moneyIn)} />
            <MetricCard title="Money Out" value={toMoney(metrics.moneyOut)} />
            <MetricCard title="Net" value={toMoney(metrics.net)} />
          </div>

          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold text-slate-100">
              Costing warnings
            </h2>
            {data?.close?.costingWarnings &&
            ((data.close.costingWarnings.missingRecipe?.length ?? 0) > 0 ||
              (data.close.costingWarnings.missingLastPrice?.length ?? 0) >
                0) ? (
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {(data.close.costingWarnings.missingRecipe?.length ?? 0) > 0 ? (
                  <p>
                    Missing recipe for{" "}
                    {data.close.costingWarnings.missingRecipe?.length}{" "}
                    product(s):{" "}
                    {(data.close.costingWarnings.missingRecipe ?? []).join(
                      ", ",
                    )}
                  </p>
                ) : null}
                {(data.close.costingWarnings.missingLastPrice?.length ?? 0) >
                0 ? (
                  <p>
                    Missing last price for{" "}
                    {data.close.costingWarnings.missingLastPrice?.length}{" "}
                    material(s):{" "}
                    {(data.close.costingWarnings.missingLastPrice ?? []).join(
                      ", ",
                    )}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                No costing warnings for this close.
              </p>
            )}
          </article>

          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold text-slate-100">Alerts</h2>
            <div className="mt-3 space-y-2">
              {alerts.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No alerts for the selected day.
                </p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 ${actionColor[alert.severity]}`}
                  >
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {alert.description}
                    </p>
                    <Link
                      href={alert.actionTarget}
                      className="mt-2 inline-flex text-xs underline underline-offset-4 hover:text-slate-50"
                    >
                      {alert.actionLabel}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold text-slate-100">
              Actionables
            </h2>
            <ul className="mt-3 space-y-2">
              {actionables.length === 0 ? (
                <li className="text-sm text-slate-400">
                  No immediate actions.
                </li>
              ) : (
                actionables.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(doneActions[item.id])}
                        onChange={() => toggleDone(item.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900"
                      />
                      <div>
                        <p
                          className={`text-sm font-medium ${doneActions[item.id] ? "line-through text-slate-500" : "text-slate-100"}`}
                        >
                          {item.title}
                        </p>
                        <p className="text-sm text-slate-400">{item.detail}</p>
                        <Link
                          href={item.actionTarget}
                          className="mt-1 inline-flex text-xs underline underline-offset-4 text-slate-300 hover:text-slate-50"
                        >
                          {item.actionLabel}
                        </Link>
                      </div>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </article>
        </section>

        <section className="space-y-5">
          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold text-slate-100">
              Top products
            </h2>
            {!data?.close ? (
              <p className="mt-3 text-sm text-slate-400">
                No close yet.{" "}
                <Link href="/daily-close/new" className="underline">
                  Create close
                </Link>
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-2 py-2 text-left">Product</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {topProducts.map((item) => (
                      <tr key={item.id}>
                        <td className="px-2 py-2 text-slate-200">
                          {item.name}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-300">
                          {item.qty}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-100">
                          {toMoney(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-100">
                Product profitability (last 7 closes)
              </h2>
              <Link
                href="/products"
                className="text-xs underline underline-offset-4 text-slate-300 hover:text-slate-50"
              >
                Manage products
              </Link>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-2 py-2 text-left">Product</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-right">Sales</th>
                    <th className="px-2 py-2 text-right">Gross Profit</th>
                    <th className="px-2 py-2 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(data?.productReport ?? []).slice(0, 8).map((row) => (
                    <tr key={row.productId}>
                      <td className="px-2 py-2 text-slate-200">{row.name}</td>
                      <td className="px-2 py-2 text-right text-slate-300">
                        {row.soldQty}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-100">
                        {toMoney(row.soldSales)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-100">
                        ${row.estimatedGrossProfit.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-300">
                        {row.marginPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold text-slate-100">
              Recent closes
            </h2>
            <ul className="mt-3 space-y-2">
              {(data?.recentCloses ?? []).map((close) => (
                <li
                  key={close.id}
                  className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/daily-close/${close.date}`}
                      className="text-sm font-medium text-slate-100 underline underline-offset-4"
                    >
                      {close.date}
                    </Link>
                    <span className="text-xs text-slate-300">
                      {close.syncStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    Sales {toMoney(close.totalFromItems)} | In{" "}
                    {toMoney(close.moneyIn)} | Out {toMoney(close.moneyOut)}
                  </p>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold text-slate-100">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
              {data?.close?.notes?.trim()
                ? data.close.notes
                : "No notes for this close."}
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
