import Link from "next/link";
import { fetchDashboardPayload } from "@/lib/operational-dashboard";
import { AppCard, MetricCard } from "@/components/ui/card";

const toMoney = (value: number) => `$${(value / 100).toFixed(2)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

export default async function WeeklyPage() {
  const payload = await fetchDashboardPayload({
    date: todayISO(),
    recentDays: 7,
    baselineDays: 7,
  }).catch(() => null);

  const recent = payload?.recentCloses ?? [];
  const totalSales = recent.reduce(
    (sum, entry) => sum + entry.totalFromItems,
    0,
  );
  const totalExpenses = recent.reduce((sum, entry) => sum + entry.moneyOut, 0);
  const totalNet = recent.reduce(
    (sum, entry) => sum + (entry.moneyIn - entry.moneyOut),
    0,
  );
  const topProducts = (payload?.baseline ?? []).slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA OPERATIONS
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">
            Weekly Summary
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard"
            className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 hover:bg-slate-800 inline-flex items-center"
          >
            Back dashboard
          </Link>
          <a
            href="/api/operational-dashboard/weekly-csv"
            className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700 inline-flex items-center"
          >
            Export CSV
          </a>
        </div>
      </header>

      {!payload ? (
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          Could not load weekly summary right now.
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <MetricCard title="Total Sales (7d)" value={toMoney(totalSales)} />
            <MetricCard
              title="Total Expenses (7d)"
              value={toMoney(totalExpenses)}
            />
            <MetricCard title="Net (7d)" value={toMoney(totalNet)} />
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            <AppCard>
              <h2 className="text-base font-semibold text-slate-100">
                Trend by day
              </h2>
              <ul className="mt-3 space-y-2">
                {recent.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                  >
                    <p className="text-sm text-slate-100">{entry.date}</p>
                    <p className="text-sm text-slate-400">
                      Sales {toMoney(entry.totalFromItems)} | Net{" "}
                      {toMoney(entry.moneyIn - entry.moneyOut)}
                    </p>
                  </li>
                ))}
              </ul>
            </AppCard>

            <AppCard>
              <h2 className="text-base font-semibold text-slate-100">
                Top products (weekly baseline)
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-2 py-2 text-left">Product</th>
                      <th className="px-2 py-2 text-right">Avg Qty</th>
                      <th className="px-2 py-2 text-right">Avg Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {topProducts.map((entry) => (
                      <tr key={entry.productId}>
                        <td className="px-2 py-2 text-slate-200">
                          {entry.name}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-300">
                          {entry.avgQty.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-100">
                          {toMoney(Math.round(entry.avgSales))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppCard>
          </section>
        </>
      )}
    </main>
  );
}
