import Link from "next/link";
import { fetchCloseReports } from "@/lib/close-reports";
import { getExpenses } from "@/lib/expenses";
import { BusinessHour, getLatestRestaurant } from "@/lib/restaurant";
import { AppCard, MetricCard } from "@/components/ui/card";

const toMoney = (value: number) => `$${(value / 100).toFixed(2)}`;

const moneyTone = (value: number) =>
  value > 0 ? "text-green-300" : "text-red-300";

const expenseTone = "text-red-500";
const salesTone = "text-green-500";

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const fromDateInput = (value: string) => new Date(`${value}T12:00:00`);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getMonday = (date: Date) => {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
};

const getWeekDays = (weekStart: string) =>
  Array.from({ length: 7 }, (_, index) =>
    toDateInput(addDays(fromDateInput(weekStart), index)),
  );

const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const getDayKey = (date: string) => dayKeys[fromDateInput(date).getDay()];

const isBusinessDayOpen = (
  businessHours: BusinessHour[] | null | undefined,
  date: string,
) => {
  const hour = businessHours?.find((item) => item.day === getDayKey(date));
  return Boolean(hour?.open && hour.openTime && hour.closeTime);
};

const dateParts = (date: string) => {
  const parsed = fromDateInput(date);
  return {
    weekday: parsed.toLocaleDateString("en-US", { weekday: "long" }),
    day: parsed.toLocaleDateString("en-US", { day: "numeric" }),
    month: parsed.toLocaleDateString("en-US", { month: "short" }),
  };
};

const normalizeProductName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const getProductAmounts = (
  closes: Array<{ items: Array<{ name: string; qty: number }> }>,
) =>
  closes.reduce(
    (sum, close) => {
      for (const item of close.items) {
        const name = normalizeProductName(item.name);
        if (name.includes("mojarra")) {
          sum.mojarras += item.qty;
        } else if (name.includes("camaron")) {
          sum.camaron += item.qty;
        } else if (name.includes("minilla")) {
          sum.minilla += item.qty;
        }
      }

      return sum;
    },
    { mojarras: 0, camaron: 0, minilla: 0 },
  );

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const currentWeekStart = toDateInput(getMonday(new Date()));
  const requestedWeek = searchParams?.week;
  const weekStart =
    requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek)
      ? toDateInput(getMonday(fromDateInput(requestedWeek)))
      : currentWeekStart;
  const weekEnd = toDateInput(addDays(fromDateInput(weekStart), 6));
  const previousWeek = toDateInput(addDays(fromDateInput(weekStart), -7));
  const nextWeek = toDateInput(addDays(fromDateInput(weekStart), 7));
  const isCurrentWeek = weekStart === currentWeekStart;
  const weekDays = getWeekDays(weekStart);

  const [closePayload, expensePayload, restaurant] = await Promise.all([
    fetchCloseReports({ take: 365 }).catch(() => null),
    getExpenses({ take: 365 }).catch(() => null),
    getLatestRestaurant().catch(() => null),
  ]);

  const closes = (closePayload?.reports ?? []).filter(
    (report) => report.date >= weekStart && report.date <= weekEnd,
  );
  const expenses = (expensePayload?.expenses ?? []).filter(
    (expense) => expense.date >= weekStart && expense.date <= weekEnd,
  );

  const rows = weekDays.map((date) => {
    const dayCloses = closes.filter((close) => close.date === date);
    const dayExpenses = expenses.filter((expense) => expense.date === date);
    const sales = dayCloses.reduce(
      (sum, close) => sum + close.totalFromItems,
      0,
    );
    const grossProfit = dayCloses.reduce(
      (sum, close) => sum + close.grossProfitCents,
      0,
    );
    const operatingProfit = dayCloses.reduce(
      (sum, close) => sum + close.operatingProfitCents,
      0,
    );
    const expenseTotal = dayExpenses.reduce(
      (sum, expense) => sum + expense.amountCents,
      0,
    );
    const moneyIn = dayCloses.reduce(
      (sum, close) => sum + close.cashReceived + close.bankTransfersReceived,
      0,
    );
    const cashReceived = dayCloses.reduce(
      (sum, close) => sum + close.cashReceived,
      0,
    );
    const bankTransfersReceived = dayCloses.reduce(
      (sum, close) => sum + close.bankTransfersReceived,
      0,
    );
    const closeMoneyOut = dayCloses.reduce(
      (sum, close) => sum + close.deliveryCashPaid + close.otherCashExpenses,
      0,
    );
    const totalExpenses = closeMoneyOut + expenseTotal;
    const productAmounts = getProductAmounts(dayCloses);

    return {
      date,
      isOpen: isBusinessDayOpen(restaurant?.businessHours, date),
      closes: dayCloses.length,
      expenses: dayExpenses.length,
      ...productAmounts,
      sales,
      grossProfit,
      operatingProfit,
      expenseTotal: totalExpenses,
      manualExpenseTotal: expenseTotal,
      closeExpenseTotal: closeMoneyOut,
      roughEarnings: sales - totalExpenses,
      moneyIn,
      cashReceived,
      bankTransfersReceived,
      moneyOut: totalExpenses,
      cashBalance: moneyIn - totalExpenses,
    };
  });

  const totals = rows.reduce(
    (sum, row) => ({
      closes: sum.closes + row.closes,
      expenses: sum.expenses + row.expenses,
      mojarras: sum.mojarras + row.mojarras,
      camaron: sum.camaron + row.camaron,
      minilla: sum.minilla + row.minilla,
      sales: sum.sales + row.sales,
      grossProfit: sum.grossProfit + row.grossProfit,
      operatingProfit: sum.operatingProfit + row.operatingProfit,
      expenseTotal: sum.expenseTotal + row.expenseTotal,
      roughEarnings: sum.roughEarnings + row.roughEarnings,
      cashReceived: sum.cashReceived + row.cashReceived,
      bankTransfersReceived:
        sum.bankTransfersReceived + row.bankTransfersReceived,
      cashBalance: sum.cashBalance + row.cashBalance,
    }),
    {
      closes: 0,
      expenses: 0,
      mojarras: 0,
      camaron: 0,
      minilla: 0,
      sales: 0,
      grossProfit: 0,
      operatingProfit: 0,
      expenseTotal: 0,
      roughEarnings: 0,
      cashReceived: 0,
      bankTransfersReceived: 0,
      cashBalance: 0,
    },
  );

  const topExpenses = [...expenses]
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA OPERATIONS
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">
            Weekly Report
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Monday {weekStart} to Sunday {weekEnd}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/weekly?week=${previousWeek}`}
            className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 hover:bg-slate-800 inline-flex items-center"
          >
            Previous
          </Link>
          {isCurrentWeek ? (
            <span
              aria-disabled="true"
              className="inline-flex h-10 cursor-not-allowed items-center rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-500"
            >
              Current
            </span>
          ) : (
            <Link
              href={`/weekly?week=${currentWeekStart}`}
              className="inline-flex h-10 items-center rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 hover:bg-slate-800"
            >
              Current
            </Link>
          )}
          {isCurrentWeek ? (
            <span
              aria-disabled="true"
              className="inline-flex h-10 cursor-not-allowed items-center rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-500"
            >
              Next
            </span>
          ) : (
            <Link
              href={`/weekly?week=${nextWeek}`}
              className="inline-flex h-10 items-center rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 hover:bg-slate-800"
            >
              Next
            </Link>
          )}
          <Link
            href="/dashboard"
            className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 hover:bg-slate-800 inline-flex items-center"
          >
            Dashboard
          </Link>
          <a
            href={`/api/operational-dashboard/weekly-csv?week=${weekStart}`}
            className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700 inline-flex items-center"
          >
            Export CSV
          </a>
        </div>
      </header>

      {!closePayload || !expensePayload ? (
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          Could not load the complete weekly report right now.
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              title="Sales"
              value={toMoney(totals.sales)}
              valueClassName={salesTone}
            />
            <MetricCard
              title="Daily Expenses"
              value={toMoney(totals.expenseTotal)}
              valueClassName={expenseTone}
            />
            <MetricCard
              title="Rough Earnings"
              value={toMoney(totals.roughEarnings)}
              valueClassName={moneyTone(totals.roughEarnings)}
            />
            <MetricCard
              title="Cash Balance"
              value={toMoney(totals.cashBalance)}
            />
            <MetricCard
              title="Gross Profit"
              value={toMoney(totals.grossProfit)}
              className="opacity-20"
            />
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            <AppCard>
              <h2 className="text-base font-semibold text-slate-100">
                Monday to Sunday
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-2 py-2 text-left">Day</th>
                      <th className="px-2 py-2 text-right">🐟</th>
                      <th className="px-2 py-2 text-right">🍤</th>
                      <th className="px-2 py-2 text-right">🥟</th>
                      <th className="px-2 py-2 text-right">Sales</th>
                      <th className="px-2 py-2 text-right">Expenses</th>
                      <th className="px-2 py-2 text-right">Rough</th>
                      <th className="px-2 py-2 text-right" title="Money in">
                        💰
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rows.map((row) => (
                      <tr
                        key={row.date}
                        className={row.isOpen ? undefined : "opacity-80"}
                      >
                        <td className="whitespace-nowrap px-2 py-2 text-slate-100">
                          <Link
                            href={`/daily-close/${row.date}`}
                            className="block max-w-14 rounded-lg px-2 py-1 underline-offset-4 hover:bg-slate-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
                          >
                            <span className="block text-xs font-medium text-slate-300">
                              {dateParts(row.date).weekday}
                            </span>
                            <span className="mt-1 flex items-end gap-1">
                              <span className="text-md font-semibold leading-none text-slate-300">
                                {dateParts(row.date).day}
                              </span>
                              <span className="text-xs uppercase leading-none text-slate-400">
                                - {dateParts(row.date).month}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-slate-300">
                          {row.mojarras}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-slate-300">
                          {row.camaron}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-slate-300">
                          {row.minilla}
                        </td>
                        <td
                          className={`whitespace-nowrap px-2 py-2 text-right ${salesTone}`}
                        >
                          {toMoney(row.sales)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-2 py-2 text-right ${expenseTone}`}
                        >
                          {toMoney(row.expenseTotal)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-2 py-2 text-right ${moneyTone(row.roughEarnings)}`}
                        >
                          {toMoney(row.roughEarnings)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <span
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-200"
                            title={`Cash: ${toMoney(row.cashReceived)}\nBank: ${toMoney(row.bankTransfersReceived)}`}
                          >
                            💰
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-950/60 font-medium">
                      <td className="whitespace-nowrap px-2 py-2 text-slate-100">
                        Total
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-slate-100">
                        {totals.mojarras}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-slate-100">
                        {totals.camaron}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-slate-100">
                        {totals.minilla}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-2 text-right ${salesTone}`}
                      >
                        {toMoney(totals.sales)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-2 text-right ${expenseTone}`}
                      >
                        {toMoney(totals.expenseTotal)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-2 text-right ${moneyTone(totals.roughEarnings)}`}
                      >
                        {toMoney(totals.roughEarnings)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-100"
                          title={`Cash: ${toMoney(totals.cashReceived)}\nBank: ${toMoney(totals.bankTransfersReceived)}`}
                        >
                          💰
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </AppCard>

            <AppCard>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-100">
                  Top Expenses
                </h2>
                <Link
                  href="/expenses"
                  className="inline-flex h-9 items-center rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm font-medium text-slate-100 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
                >
                  Add Expense
                </Link>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Concept</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {topExpenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="whitespace-nowrap px-2 py-2 text-slate-300">
                          {expense.date}
                        </td>
                        <td className="px-2 py-2 text-slate-200">
                          {expense.concept}
                        </td>
                        <td className={`px-2 py-2 text-right ${expenseTone}`}>
                          {toMoney(expense.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {topExpenses.length === 0 ? (
                <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">
                  No expenses for this week.
                </p>
              ) : null}
            </AppCard>
          </section>
        </>
      )}
    </main>
  );
}
