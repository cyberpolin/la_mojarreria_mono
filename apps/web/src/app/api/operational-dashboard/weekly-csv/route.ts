import { NextRequest, NextResponse } from "next/server";
import { fetchCloseReports } from "@/lib/close-reports";
import { getExpenses } from "@/lib/expenses";

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

const csvCell = (value: string | number) => {
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedWeek = searchParams.get("week");
  const weekStart =
    requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek)
      ? toDateInput(getMonday(fromDateInput(requestedWeek)))
      : toDateInput(getMonday(new Date()));
  const weekEnd = toDateInput(addDays(fromDateInput(weekStart), 6));
  const weekDays = getWeekDays(weekStart);

  try {
    const [closePayload, expensePayload] = await Promise.all([
      fetchCloseReports({ take: 365 }),
      getExpenses({ take: 365 }),
    ]);

    const closes = closePayload.reports.filter(
      (report) => report.date >= weekStart && report.date <= weekEnd,
    );
    const expenses = expensePayload.expenses.filter(
      (expense) => expense.date >= weekStart && expense.date <= weekEnd,
    );

    const rows = [
      [
        "date",
        "salesTotal",
        "grossProfit",
        "operatingProfit",
        "dailyExpenses",
        "roughEarnings",
        "cashBalance",
        "closes",
        "expenseEntries",
      ],
      ...weekDays.map((date) => {
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
          (sum, close) =>
            sum + close.cashReceived + close.bankTransfersReceived,
          0,
        );
        const closeMoneyOut = dayCloses.reduce(
          (sum, close) =>
            sum + close.deliveryCashPaid + close.otherCashExpenses,
          0,
        );

        return [
          date,
          sales,
          grossProfit,
          operatingProfit,
          expenseTotal,
          sales - expenseTotal,
          moneyIn - closeMoneyOut - expenseTotal,
          dayCloses.length,
          dayExpenses.length,
        ];
      }),
    ];

    const csv = rows
      .map((row) => row.map((cell) => csvCell(cell)).join(","))
      .join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mojarreria-weekly-${weekStart}-to-${weekEnd}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export weekly csv",
      },
      { status: 500 },
    );
  }
}
