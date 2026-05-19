import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG } from "@/constants/config";

export type WeeklyCloseReport = {
  id: string;
  date: string;
  deviceId: string;
  cashReceived: number;
  bankTransfersReceived: number;
  deliveryCashPaid: number;
  otherCashExpenses: number;
  totalFromItems: number;
  grossProfitCents: number;
  operatingProfitCents: number;
};

export type WeeklyExpense = {
  id: string;
  date: string;
  concept: string;
  amountCents: number;
  notes: string;
};

export type WeeklyReportDay = {
  date: string;
  closes: number;
  expenses: number;
  sales: number;
  grossProfit: number;
  operatingProfit: number;
  expenseTotal: number;
  roughEarnings: number;
  moneyIn: number;
  moneyOut: number;
  cashBalance: number;
};

export type WeeklyReportPayload = {
  weekStart: string;
  weekEnd: string;
  fetchedAt: string;
  rows: WeeklyReportDay[];
  topExpenses: WeeklyExpense[];
  totals: {
    closes: number;
    expenses: number;
    sales: number;
    grossProfit: number;
    operatingProfit: number;
    expenseTotal: number;
    roughEarnings: number;
    cashBalance: number;
  };
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message?: string }[];
};

const WEEKLY_REPORT_QUERY = `
  query MobileWeeklyReport($from: String!, $to: String!) {
    dailyCloses(
      where: { date: { gte: $from, lte: $to } }
      orderBy: [{ date: asc }]
      take: 50
    ) {
      id
      date
      deviceId
      cashReceived
      bankTransfersReceived
      deliveryCashPaid
      otherCashExpenses
      totalFromItems
      grossProfitCents
      operatingProfitCents
    }
    dailyExpenses(
      where: { date: { gte: $from, lte: $to } }
      orderBy: [{ date: asc }, { createdAt: desc }]
      take: 200
    ) {
      id
      date
      concept
      amountCents
      notes
    }
  }
`;

const cacheKey = (weekStart: string) =>
  `MOJARRERIA_MOBILE_WEEKLY_REPORT_V1_${weekStart}`;

export const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const fromDateInput = (value: string) => new Date(`${value}T12:00:00`);

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getMonday = (date: Date) => {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
};

export const getWeekDays = (weekStart: string) =>
  Array.from({ length: 7 }, (_, index) =>
    toDateInput(addDays(fromDateInput(weekStart), index)),
  );

export const getCurrentWeekStart = () => toDateInput(getMonday(new Date()));

const buildPayload = ({
  weekStart,
  closes,
  expenses,
}: {
  weekStart: string;
  closes: WeeklyCloseReport[];
  expenses: WeeklyExpense[];
}): WeeklyReportPayload => {
  const weekEnd = toDateInput(addDays(fromDateInput(weekStart), 6));
  const rows = getWeekDays(weekStart).map((date) => {
    const dayCloses = closes.filter((close) => close.date === date);
    const dayExpenses = expenses.filter((expense) => expense.date === date);
    const sales = dayCloses.reduce(
      (sum, close) => sum + Number(close.totalFromItems ?? 0),
      0,
    );
    const grossProfit = dayCloses.reduce(
      (sum, close) => sum + Number(close.grossProfitCents ?? 0),
      0,
    );
    const operatingProfit = dayCloses.reduce(
      (sum, close) => sum + Number(close.operatingProfitCents ?? 0),
      0,
    );
    const expenseTotal = dayExpenses.reduce(
      (sum, expense) => sum + Number(expense.amountCents ?? 0),
      0,
    );
    const moneyIn = dayCloses.reduce(
      (sum, close) =>
        sum +
        Number(close.cashReceived ?? 0) +
        Number(close.bankTransfersReceived ?? 0),
      0,
    );
    const closeMoneyOut = dayCloses.reduce(
      (sum, close) =>
        sum +
        Number(close.deliveryCashPaid ?? 0) +
        Number(close.otherCashExpenses ?? 0),
      0,
    );

    return {
      date,
      closes: dayCloses.length,
      expenses: dayExpenses.length,
      sales,
      grossProfit,
      operatingProfit,
      expenseTotal,
      roughEarnings: sales - expenseTotal,
      moneyIn,
      moneyOut: closeMoneyOut + expenseTotal,
      cashBalance: moneyIn - closeMoneyOut - expenseTotal,
    };
  });

  const totals = rows.reduce(
    (sum, row) => ({
      closes: sum.closes + row.closes,
      expenses: sum.expenses + row.expenses,
      sales: sum.sales + row.sales,
      grossProfit: sum.grossProfit + row.grossProfit,
      operatingProfit: sum.operatingProfit + row.operatingProfit,
      expenseTotal: sum.expenseTotal + row.expenseTotal,
      roughEarnings: sum.roughEarnings + row.roughEarnings,
      cashBalance: sum.cashBalance + row.cashBalance,
    }),
    {
      closes: 0,
      expenses: 0,
      sales: 0,
      grossProfit: 0,
      operatingProfit: 0,
      expenseTotal: 0,
      roughEarnings: 0,
      cashBalance: 0,
    },
  );

  return {
    weekStart,
    weekEnd,
    fetchedAt: new Date().toISOString(),
    rows,
    totals,
    topExpenses: [...expenses]
      .sort((a, b) => b.amountCents - a.amountCents)
      .slice(0, 10),
  };
};

export const readCachedWeeklyReport = async (weekStart: string) => {
  const raw = await AsyncStorage.getItem(cacheKey(weekStart));
  if (!raw) return null;
  return JSON.parse(raw) as WeeklyReportPayload;
};

export const fetchWeeklyReport = async (weekStart: string) => {
  const weekEnd = toDateInput(addDays(fromDateInput(weekStart), 6));
  const response = await fetch(`${APP_CONFIG.apiUrl}/api/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: WEEKLY_REPORT_QUERY,
      variables: { from: weekStart, to: weekEnd },
    }),
  });

  const payload = (await response.json().catch(() => null)) as GraphQLResponse<{
    dailyCloses: WeeklyCloseReport[];
    dailyExpenses: WeeklyExpense[];
  }> | null;

  if (!response.ok) {
    throw new Error(`Weekly report request failed (${response.status}).`);
  }

  if (payload?.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Weekly report failed.");
  }

  const report = buildPayload({
    weekStart,
    closes: payload?.data?.dailyCloses ?? [],
    expenses: payload?.data?.dailyExpenses ?? [],
  });

  await AsyncStorage.setItem(cacheKey(weekStart), JSON.stringify(report));
  return report;
};
