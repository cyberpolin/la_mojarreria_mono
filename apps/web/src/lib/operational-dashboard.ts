import {
  DashboardPayload,
  DailyCloseDashboard,
  ProductOperationalReportRow,
  RecentDailyCloseSummary,
  SyncStatusInfo,
  WeeklyProductBaseline,
} from "@/types/dashboard";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const DASHBOARD_QUERY = `
  query OperationalDashboard($date: String!, $recentDays: Int!, $baselineDays: Int!) {
    getDailyClose(date: $date) {
      id
      date
      deviceId
      cashReceived
      bankTransfersReceived
      deliveryCashPaid
      otherCashExpenses
      expectedTotal
      totalFromItems
      cogsCents
      grossProfitCents
      grossMarginBps
      costingStatus
      costingWarnings
      notes
      status
      syncedAt
      syncStatus
      lastSyncAttemptAt
      lastSyncErrorMessage
      items {
        id
        productId
        name
        qty
        price
        subtotal
      }
    }
    getRecentDailyCloses(days: $recentDays) {
      id
      date
      deviceId
      totalFromItems
      moneyIn
      moneyOut
      syncStatus
      syncedAt
      status
    }
    getWeeklyProductBaseline(days: $baselineDays) {
      productId
      name
      avgQty
      avgSales
      sampleDays
    }
    getSyncStatus(date: $date) {
      date
      deviceId
      syncStatus
      syncedAt
      lastSyncAttemptAt
      hasSyncFailure
      lastErrorMessage
    }
    getProductOperationalReport(days: $baselineDays) {
      productId
      name
      price
      rawCost
      soldQty
      soldSales
      avgDailyQty
      avgDailySales
      estimatedGrossProfit
      marginPercent
    }
  }
`;

const getEndpoint = () =>
  process.env.KEYSTONE_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
  "http://localhost:3000/api/graphql";

export const fetchDashboardPayload = async ({
  date,
  recentDays = 7,
  baselineDays = 7,
}: {
  date: string;
  recentDays?: number;
  baselineDays?: number;
}): Promise<DashboardPayload> => {
  const endpoint = getEndpoint();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: DASHBOARD_QUERY,
      variables: { date, recentDays, baselineDays },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Dashboard query failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GraphQLResponse<{
    getDailyClose: DailyCloseDashboard | null;
    getRecentDailyCloses: RecentDailyCloseSummary[];
    getWeeklyProductBaseline: WeeklyProductBaseline[];
    getSyncStatus: SyncStatusInfo;
    getProductOperationalReport: ProductOperationalReportRow[];
  }>;

  if (payload.errors?.length) {
    throw new Error(
      payload.errors[0]?.message ?? "Unknown GraphQL dashboard error",
    );
  }

  if (!payload.data) {
    throw new Error("Dashboard payload missing data");
  }

  return {
    selectedDate: date,
    close: payload.data.getDailyClose,
    recentCloses: payload.data.getRecentDailyCloses ?? [],
    baseline: payload.data.getWeeklyProductBaseline ?? [],
    productReport: payload.data.getProductOperationalReport ?? [],
    syncStatus: payload.data.getSyncStatus,
  };
};
