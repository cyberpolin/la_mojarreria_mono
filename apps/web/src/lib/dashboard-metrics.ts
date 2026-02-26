import {
  DashboardMetrics,
  DailyCloseDashboard,
  RecentDailyCloseSummary,
  WeeklyProductBaseline,
} from "@/types/dashboard";

export const buildDashboardMetrics = (
  close: DailyCloseDashboard | null,
  _recent: RecentDailyCloseSummary[],
  _baseline: WeeklyProductBaseline[],
): DashboardMetrics => {
  if (!close) {
    return {
      salesTotal: 0,
      cogsCents: 0,
      grossProfitCents: 0,
      grossMarginPct: 0,
      moneyIn: 0,
      moneyOut: 0,
      net: 0,
      hasClose: false,
      isSynced: false,
      descuadreAmount: 0,
    };
  }

  const salesTotal = close.totalFromItems;
  const cogsCents = close.cogsCents ?? 0;
  const grossProfitCents = close.grossProfitCents ?? salesTotal - cogsCents;
  const grossMarginPct =
    salesTotal > 0 ? (grossProfitCents / salesTotal) * 100 : 0;
  const moneyIn = close.cashReceived + close.bankTransfersReceived;
  const moneyOut = close.deliveryCashPaid + close.otherCashExpenses;
  const net = moneyIn - moneyOut;
  const descuadreAmount = moneyIn - salesTotal;

  return {
    salesTotal,
    cogsCents,
    grossProfitCents,
    grossMarginPct,
    moneyIn,
    moneyOut,
    net,
    hasClose: true,
    isSynced: close.syncStatus === "SUCCESS",
    descuadreAmount,
  };
};

const formatMoney = (value: number) => `$${(value / 100).toFixed(2)}`;

export const dashboardMetricsConsoleCheck = () => {
  const close = {
    id: "c1",
    date: "2026-02-25",
    deviceId: "kiosk-001",
    cashReceived: 10000,
    bankTransfersReceived: 2500,
    deliveryCashPaid: 1500,
    otherCashExpenses: 500,
    expectedTotal: 10000,
    totalFromItems: 12000,
    cogsCents: 5600,
    grossProfitCents: 6400,
    grossMarginBps: 5333,
    costingStatus: "COMPLETE" as const,
    costingWarnings: null,
    notes: "",
    status: "ACTIVE",
    syncedAt: null,
    syncStatus: "PENDING" as const,
    lastSyncAttemptAt: null,
    lastSyncErrorMessage: null,
    items: [],
  };

  const metrics = buildDashboardMetrics(close, [], []);
  console.log(
    "[dashboard-metrics.check] salesTotal:",
    formatMoney(metrics.salesTotal),
  );
  console.log(
    "[dashboard-metrics.check] moneyIn:",
    formatMoney(metrics.moneyIn),
  );
  console.log(
    "[dashboard-metrics.check] moneyOut:",
    formatMoney(metrics.moneyOut),
  );
  console.log("[dashboard-metrics.check] net:", formatMoney(metrics.net));
  console.log(
    "[dashboard-metrics.check] cogs:",
    formatMoney(metrics.cogsCents),
  );
  console.log(
    "[dashboard-metrics.check] grossProfit:",
    formatMoney(metrics.grossProfitCents),
  );
  console.log(
    "[dashboard-metrics.check] grossMarginPct:",
    `${metrics.grossMarginPct.toFixed(2)}%`,
  );
  console.log(
    "[dashboard-metrics.check] descuadre:",
    formatMoney(metrics.descuadreAmount),
  );
};
