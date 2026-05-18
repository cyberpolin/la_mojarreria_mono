export type CloseReportItem = {
  id: string;
  productId: string;
  name: string;
  qty: number;
  price: number;
  subtotal: number;
};

export type CloseReportOperator = {
  id: string;
  name: string;
  phone: string;
} | null;

export type CloseReportRaw = {
  id: string;
  status: string;
  receivedAt: string | null;
  processedAt: string | null;
  errorMessage: string | null;
} | null;

export type CloseReport = {
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
  allocatedFixedExpensesCents: number;
  fixedExpenseRatioBps: number;
  operatingProfitCents: number;
  operatingMarginBps: number;
  costingStatus: "PENDING" | "COMPLETE" | "PARTIAL";
  costingWarnings: {
    missingRecipe?: string[];
    missingLastPrice?: string[];
  } | null;
  notes: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  closedBy: CloseReportOperator;
  sourceRaw: CloseReportRaw;
  items: CloseReportItem[];
};

export type CloseReportsPayload = {
  reports: CloseReport[];
};
