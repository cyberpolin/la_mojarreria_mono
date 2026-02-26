export type SyncStatus = "SUCCESS" | "FAILED" | "PENDING";

export type DailyCloseItemMetric = {
  id: string;
  productId: string;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
};

export type DailyCloseDashboard = {
  id: string;
  date: string;
  deviceId: string;
  cashReceived: number;
  bankTransfersReceived: number;
  deliveryCashPaid: number;
  otherCashExpenses: number;
  expectedTotal: number;
  totalFromItems: number;
  cogsCents: number;
  grossProfitCents: number;
  grossMarginBps: number;
  costingStatus: "PENDING" | "COMPLETE" | "PARTIAL";
  costingWarnings: {
    missingRecipe?: string[];
    missingLastPrice?: string[];
  } | null;
  notes: string;
  status: string;
  syncedAt: string | null;
  syncStatus: SyncStatus;
  lastSyncAttemptAt: string | null;
  lastSyncErrorMessage: string | null;
  items: DailyCloseItemMetric[];
};

export type RecentDailyCloseSummary = {
  id: string;
  date: string;
  deviceId: string;
  totalFromItems: number;
  moneyIn: number;
  moneyOut: number;
  syncStatus: SyncStatus;
  syncedAt: string | null;
  status: string;
};

export type WeeklyProductBaseline = {
  productId: string;
  name: string;
  avgQty: number;
  avgSales: number;
  sampleDays: number;
};

export type SyncStatusInfo = {
  date: string;
  deviceId: string;
  syncStatus: SyncStatus;
  syncedAt: string | null;
  lastSyncAttemptAt: string | null;
  hasSyncFailure: boolean;
  lastErrorMessage: string | null;
};

export type ProductOperationalReportRow = {
  productId: string;
  name: string;
  price: number;
  rawCost: number;
  soldQty: number;
  soldSales: number;
  avgDailyQty: number;
  avgDailySales: number;
  estimatedGrossProfit: number;
  marginPercent: number;
};

export type DashboardPayload = {
  selectedDate: string;
  close: DailyCloseDashboard | null;
  recentCloses: RecentDailyCloseSummary[];
  baseline: WeeklyProductBaseline[];
  productReport: ProductOperationalReportRow[];
  syncStatus: SyncStatusInfo;
};

export type DashboardMetrics = {
  salesTotal: number;
  cogsCents: number;
  grossProfitCents: number;
  grossMarginPct: number;
  moneyIn: number;
  moneyOut: number;
  net: number;
  hasClose: boolean;
  isSynced: boolean;
  descuadreAmount: number;
};

export type DashboardAlert = {
  id: string;
  severity: "info" | "warn" | "error";
  title: string;
  description: string;
  actionLabel: string;
  actionTarget: string;
};

export type DashboardActionable = {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  actionTarget: string;
};
