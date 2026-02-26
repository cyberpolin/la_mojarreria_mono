import {
  DashboardAlert,
  DailyCloseDashboard,
  DashboardMetrics,
  WeeklyProductBaseline,
  SyncStatusInfo,
} from "@/types/dashboard";

export type AlertThresholds = {
  descuadreThreshold: number;
  expenseRatioThreshold: number;
  syncStaleMinutes: number;
  dropFactor: number;
  missingCloseHourLocal: number;
};

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  descuadreThreshold: 1000,
  expenseRatioThreshold: 0.4,
  syncStaleMinutes: 15,
  dropFactor: 0.6,
  missingCloseHourLocal: 17,
};

export const generateAlerts = ({
  selectedDate,
  close,
  metrics,
  baseline,
  syncStatus,
  now = new Date(),
  thresholds = DEFAULT_ALERT_THRESHOLDS,
}: {
  selectedDate: string;
  close: DailyCloseDashboard | null;
  metrics: DashboardMetrics;
  baseline: WeeklyProductBaseline[];
  syncStatus: SyncStatusInfo;
  now?: Date;
  thresholds?: AlertThresholds;
}): DashboardAlert[] => {
  const alerts: DashboardAlert[] = [];

  const selected = new Date(`${selectedDate}T00:00:00`);
  const isSameDay = selected.toDateString() === new Date(now).toDateString();
  const afterCutoff = now.getHours() >= thresholds.missingCloseHourLocal;
  if (!close && isSameDay && afterCutoff) {
    alerts.push({
      id: "missing-close",
      severity: "error",
      title: "Missing close",
      description: `No DailyClose was found for ${selectedDate} after ${thresholds.missingCloseHourLocal}:00.`,
      actionLabel: "Create close",
      actionTarget: "/daily-close/new",
    });
  }

  if (
    close &&
    Math.abs(metrics.descuadreAmount) > thresholds.descuadreThreshold
  ) {
    alerts.push({
      id: "descuadre",
      severity: "error",
      title: "Descuadre detected",
      description: `Difference between money in and item sales is ${(metrics.descuadreAmount / 100).toFixed(2)}.`,
      actionLabel: "Review close details",
      actionTarget: `/daily-close/${selectedDate}`,
    });
  }

  if (
    close &&
    metrics.salesTotal > 0 &&
    metrics.moneyOut > metrics.salesTotal * thresholds.expenseRatioThreshold
  ) {
    alerts.push({
      id: "high-expenses",
      severity: "warn",
      title: "High expenses",
      description:
        "Operational expenses are above configured threshold for this close.",
      actionLabel: "Inspect expenses",
      actionTarget: `/daily-close/${selectedDate}`,
    });
  }

  if (syncStatus.syncStatus !== "SUCCESS") {
    const lastAttempt = syncStatus.lastSyncAttemptAt
      ? new Date(syncStatus.lastSyncAttemptAt)
      : null;
    const staleMinutes = lastAttempt
      ? (now.getTime() - lastAttempt.getTime()) / (1000 * 60)
      : Number.POSITIVE_INFINITY;
    if (
      syncStatus.syncStatus === "FAILED" ||
      staleMinutes > thresholds.syncStaleMinutes
    ) {
      alerts.push({
        id: "sync-failure",
        severity: "error",
        title: "Sync failure or pending",
        description:
          syncStatus.lastErrorMessage ??
          `Latest sync is stale (${Math.floor(staleMinutes)} minutes) and not marked as SUCCESS.`,
        actionLabel: "View sync logs",
        actionTarget: "/sync-logs",
      });
    }
  }

  if (close) {
    for (const item of close.items) {
      const productBaseline = baseline.find(
        (entry) => entry.productId === item.productId,
      );
      if (!productBaseline) continue;
      if (productBaseline.avgQty <= 0) continue;
      if (item.qty < productBaseline.avgQty * thresholds.dropFactor) {
        alerts.push({
          id: `drop-${item.productId}`,
          severity: "warn",
          title: "Abnormal product drop",
          description: `${item.name} qty (${item.qty}) is below baseline avg (${productBaseline.avgQty.toFixed(1)}).`,
          actionLabel: "Check inventory",
          actionTarget: `/daily-close/${selectedDate}`,
        });
      }
    }
  }

  return alerts;
};
