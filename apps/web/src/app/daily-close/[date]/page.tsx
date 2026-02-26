import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchDashboardPayload } from "@/lib/operational-dashboard";
import { formatDailyCloseSummary } from "@/lib/daily-close-summary";
import { CopySummaryButton } from "@/components/dashboard/copy-summary-button";
import { AppCard, MetricCard } from "@/components/ui/card";

const toMoney = (value: number) => `$${(value / 100).toFixed(2)}`;

export default async function DailyCloseDetailPage({
  params,
}: {
  params: { date: string };
}) {
  const data = await fetchDashboardPayload({
    date: params.date,
    recentDays: 14,
    baselineDays: 14,
  }).catch(() => null);

  if (!data || !data.close) notFound();

  const close = data.close;
  const moneyIn = close.cashReceived + close.bankTransfersReceived;
  const moneyOut = close.deliveryCashPaid + close.otherCashExpenses;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA DAILY CLOSE
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">{close.date}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard"
            className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 hover:bg-slate-800 inline-flex items-center"
          >
            Back dashboard
          </Link>
          <CopySummaryButton text={formatDailyCloseSummary(close)} />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <MetricCard title="Sales" value={toMoney(close.totalFromItems)} />
        <MetricCard title="COGS" value={toMoney(close.cogsCents)} />
        <MetricCard
          title="Gross Profit"
          value={toMoney(close.grossProfitCents)}
        />
        <MetricCard
          title="Gross Margin"
          value={`${(close.grossMarginBps / 100).toFixed(2)}%`}
        />
        <MetricCard title="Money In" value={toMoney(moneyIn)} />
        <MetricCard title="Money Out" value={toMoney(moneyOut)} />
        <MetricCard title="Net" value={toMoney(moneyIn - moneyOut)} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <AppCard>
          <h2 className="text-base font-semibold text-slate-100">Items</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Product</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {close.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-2 text-slate-200">{item.name}</td>
                    <td className="px-2 py-2 text-right text-slate-300">
                      {item.qty}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-300">
                      {toMoney(item.price)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-100">
                      {toMoney(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>

        <aside className="space-y-4">
          <AppCard>
            <h2 className="text-base font-semibold text-slate-100">
              Costing status
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Status: {close.costingStatus}
            </p>
            {close.costingWarnings &&
            ((close.costingWarnings.missingRecipe?.length ?? 0) > 0 ||
              (close.costingWarnings.missingLastPrice?.length ?? 0) > 0) ? (
              <div className="mt-2 text-sm text-slate-300">
                {(close.costingWarnings.missingRecipe?.length ?? 0) > 0 ? (
                  <p>
                    Missing recipe:{" "}
                    {(close.costingWarnings.missingRecipe ?? []).join(", ")}
                  </p>
                ) : null}
                {(close.costingWarnings.missingLastPrice?.length ?? 0) > 0 ? (
                  <p>
                    Missing last price:{" "}
                    {(close.costingWarnings.missingLastPrice ?? []).join(", ")}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                No costing warnings.
              </p>
            )}
          </AppCard>

          <AppCard>
            <h2 className="text-base font-semibold text-slate-100">
              Sync status
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Status: {close.syncStatus}
            </p>
            <p className="text-sm text-slate-300">
              Last attempt: {close.lastSyncAttemptAt ?? "-"}
            </p>
            <p className="text-sm text-slate-300">
              Synced at: {close.syncedAt ?? "-"}
            </p>
            {close.lastSyncErrorMessage ? (
              <p className="mt-2 text-sm text-slate-200">
                Error: {close.lastSyncErrorMessage}
              </p>
            ) : null}
            <Link
              href="/sync-logs"
              className="mt-3 inline-flex text-xs underline underline-offset-4 text-slate-300 hover:text-slate-50"
            >
              View sync logs
            </Link>
          </AppCard>

          <AppCard>
            <h2 className="text-base font-semibold text-slate-100">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
              {close.notes?.trim() ? close.notes : "No notes."}
            </p>
          </AppCard>
        </aside>
      </section>
    </main>
  );
}
