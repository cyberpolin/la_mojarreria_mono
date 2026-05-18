"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppCard, MetricCard } from "@/components/ui/card";
import { CloseReport, CloseReportsPayload } from "@/types/close-report";

const CACHE_KEY = "MOJARRERIA_CLOSE_REPORTS_CACHE_V1";

const toMoney = (value: number) => `$${(value / 100).toFixed(2)}`;

const toPercent = (bps: number) => `${(bps / 100).toFixed(2)}%`;

const getMoneyIn = (report: CloseReport) =>
  report.cashReceived + report.bankTransfersReceived;

const getMoneyOut = (report: CloseReport) =>
  report.deliveryCashPaid + report.otherCashExpenses;

const getReportText = (report: CloseReport) =>
  [
    report.date,
    report.deviceId,
    report.status,
    report.costingStatus,
    report.closedBy?.name ?? "",
    report.closedBy?.phone ?? "",
    report.sourceRaw?.status ?? "",
    report.notes,
  ]
    .join(" ")
    .toLowerCase();

const getDateValue = (value: string) => (value ? value : null);

export function CloseReportsClient() {
  const [reports, setReports] = useState<CloseReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setFromCache(false);

      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const payload = JSON.parse(cached) as CloseReportsPayload;
        setReports(payload.reports);
        setSelectedId((current) => current ?? payload.reports[0]?.id ?? null);
        setFromCache(true);
      }

      try {
        const response = await fetch("/api/close-reports?limit=180", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Close reports request failed (${response.status})`);
        }

        const payload = (await response.json()) as CloseReportsPayload;
        if (cancelled) return;
        setReports(payload.reports);
        setSelectedId((current) => {
          if (
            current &&
            payload.reports.some((report) => report.id === current)
          )
            return current;
          return payload.reports[0]?.id ?? null;
        });
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        setFromCache(false);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load close reports",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const minDate = getDateValue(fromDate);
    const maxDate = getDateValue(toDate);

    return reports.filter((report) => {
      if (normalizedQuery && !getReportText(report).includes(normalizedQuery)) {
        return false;
      }
      if (minDate && report.date < minDate) return false;
      if (maxDate && report.date > maxDate) return false;
      if (status !== "ALL" && report.costingStatus !== status) return false;
      return true;
    });
  }, [fromDate, query, reports, status, toDate]);

  const selectedReport = useMemo(
    () =>
      filteredReports.find((report) => report.id === selectedId) ??
      filteredReports[0] ??
      null,
    [filteredReports, selectedId],
  );

  const totals = useMemo(
    () =>
      filteredReports.reduce(
        (sum, report) => ({
          sales: sum.sales + report.totalFromItems,
          grossProfit: sum.grossProfit + report.grossProfitCents,
          operatingProfit: sum.operatingProfit + report.operatingProfitCents,
          moneyIn: sum.moneyIn + getMoneyIn(report),
          moneyOut: sum.moneyOut + getMoneyOut(report),
        }),
        {
          sales: 0,
          grossProfit: 0,
          operatingProfit: 0,
          moneyIn: 0,
          moneyOut: 0,
        },
      ),
    [filteredReports],
  );

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA CLOSES
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">
            Close Reports
          </h1>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
        >
          Dashboard
        </Link>
      </header>

      {error ? (
        <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          <p className="font-medium text-slate-100">Data source issue</p>
          <p>{error}</p>
          {fromCache ? (
            <p className="mt-1 text-slate-300">Showing cached close reports.</p>
          ) : null}
        </section>
      ) : null}

      {loading ? (
        <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          Loading close reports...
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Reports" value={String(filteredReports.length)} />
        <MetricCard title="Sales" value={toMoney(totals.sales)} />
        <MetricCard title="Gross Profit" value={toMoney(totals.grossProfit)} />
        <MetricCard
          title="Operating Profit"
          value={toMoney(totals.operatingProfit)}
        />
        <MetricCard
          title="Cash Balance"
          value={toMoney(totals.moneyIn - totals.moneyOut)}
        />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <AppCard>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm text-slate-300">
              Search
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Date, device, operator, phone"
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              From
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              To
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Costing
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
              >
                <option value="ALL">All</option>
                <option value="COMPLETE">Complete</option>
                <option value="PARTIAL">Partial</option>
                <option value="PENDING">Pending</option>
              </select>
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Device</th>
                  <th className="px-2 py-2 text-right">Sales</th>
                  <th className="px-2 py-2 text-right">Profit</th>
                  <th className="px-2 py-2 text-left">Operator</th>
                  <th className="px-2 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => setSelectedId(report.id)}
                    className={
                      selectedReport?.id === report.id
                        ? "cursor-pointer bg-slate-800/70"
                        : "cursor-pointer hover:bg-slate-800/50"
                    }
                  >
                    <td className="whitespace-nowrap px-2 py-3 text-slate-100">
                      {report.date}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-slate-300">
                      {report.deviceId}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right text-slate-100">
                      {toMoney(report.totalFromItems)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right text-slate-300">
                      {toMoney(report.operatingProfitCents)}
                    </td>
                    <td className="px-2 py-3 text-slate-300">
                      {report.closedBy?.name ?? "-"}
                    </td>
                    <td className="px-2 py-3">
                      <span className="inline-flex rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-200">
                        {report.costingStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReports.length === 0 ? (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
              No close reports match the current filters.
            </div>
          ) : null}
        </AppCard>

        <aside className="space-y-5">
          {selectedReport ? (
            <>
              <AppCard>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Selected Close
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-50">
                      {selectedReport.date}
                    </h2>
                  </div>
                  <Link
                    href={`/daily-close/${selectedReport.date}`}
                    className="inline-flex h-10 items-center rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
                  >
                    Detail
                  </Link>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-400">Sales</dt>
                    <dd className="mt-1 font-medium text-slate-100">
                      {toMoney(selectedReport.totalFromItems)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Expected</dt>
                    <dd className="mt-1 font-medium text-slate-100">
                      {toMoney(selectedReport.expectedTotal)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Gross margin</dt>
                    <dd className="mt-1 font-medium text-slate-100">
                      {toPercent(selectedReport.grossMarginBps)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Operating margin</dt>
                    <dd className="mt-1 font-medium text-slate-100">
                      {toPercent(selectedReport.operatingMarginBps)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Money in</dt>
                    <dd className="mt-1 font-medium text-slate-100">
                      {toMoney(getMoneyIn(selectedReport))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Money out</dt>
                    <dd className="mt-1 font-medium text-slate-100">
                      {toMoney(getMoneyOut(selectedReport))}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                  <p>Device: {selectedReport.deviceId}</p>
                  <p>
                    Operator: {selectedReport.closedBy?.name ?? "-"}{" "}
                    {selectedReport.closedBy?.phone
                      ? `(${selectedReport.closedBy.phone})`
                      : ""}
                  </p>
                  <p>Raw status: {selectedReport.sourceRaw?.status ?? "-"}</p>
                  <p>Updated: {selectedReport.updatedAt ?? "-"}</p>
                </div>
              </AppCard>

              <AppCard>
                <h2 className="text-base font-semibold text-slate-100">
                  Top Items
                </h2>
                <div className="mt-3 space-y-2">
                  {selectedReport.items.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          Qty {item.qty} · {toMoney(item.price)}
                        </p>
                      </div>
                      <p className="text-right font-medium text-slate-100">
                        {toMoney(item.subtotal)}
                      </p>
                    </div>
                  ))}
                  {selectedReport.items.length === 0 ? (
                    <p className="text-sm text-slate-400">No items recorded.</p>
                  ) : null}
                </div>
              </AppCard>

              <AppCard>
                <h2 className="text-base font-semibold text-slate-100">
                  Costing Warnings
                </h2>
                {selectedReport.costingWarnings &&
                ((selectedReport.costingWarnings.missingRecipe?.length ?? 0) >
                  0 ||
                  (selectedReport.costingWarnings.missingLastPrice?.length ??
                    0) > 0) ? (
                  <div className="mt-2 space-y-2 text-sm text-slate-300">
                    {(selectedReport.costingWarnings.missingRecipe?.length ??
                      0) > 0 ? (
                      <p>
                        Missing recipe:{" "}
                        {(
                          selectedReport.costingWarnings.missingRecipe ?? []
                        ).join(", ")}
                      </p>
                    ) : null}
                    {(selectedReport.costingWarnings.missingLastPrice?.length ??
                      0) > 0 ? (
                      <p>
                        Missing last price:{" "}
                        {(
                          selectedReport.costingWarnings.missingLastPrice ?? []
                        ).join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    No costing warnings.
                  </p>
                )}
              </AppCard>
            </>
          ) : (
            <AppCard>
              <p className="text-sm text-slate-300">
                Select a close report to see detail.
              </p>
            </AppCard>
          )}
        </aside>
      </section>
    </main>
  );
}
