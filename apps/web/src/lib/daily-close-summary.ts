import { DailyCloseDashboard } from "@/types/dashboard";

const money = (value: number) => `$${(value / 100).toFixed(2)}`;

export const formatDailyCloseSummary = (close: DailyCloseDashboard) => {
  const moneyIn = close.cashReceived + close.bankTransfersReceived;
  const moneyOut = close.deliveryCashPaid + close.otherCashExpenses;
  const net = moneyIn - moneyOut;

  return [
    `MOJARRERIA Daily Close ${close.date}`,
    `Device: ${close.deviceId}`,
    `Sales: ${money(close.totalFromItems)}`,
    `Money In: ${money(moneyIn)}`,
    `Money Out: ${money(moneyOut)}`,
    `Net: ${money(net)}`,
    `Sync: ${close.syncStatus}${close.syncedAt ? ` at ${close.syncedAt}` : ""}`,
  ].join("\n");
};
