import { buildAuthHeaders } from "@/lib/web-auth.server";
import { CloseReport, CloseReportsPayload } from "@/types/close-report";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const CLOSE_REPORTS_QUERY = `
  query CloseReports($take: Int!) {
    dailyCloses(orderBy: [{ date: desc }], take: $take) {
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
      allocatedFixedExpensesCents
      fixedExpenseRatioBps
      operatingProfitCents
      operatingMarginBps
      costingStatus
      costingWarnings
      notes
      status
      createdAt
      updatedAt
      closedBy {
        id
        name
        phone
      }
      sourceRaw {
        id
        status
        receivedAt
        processedAt
        errorMessage
      }
      items(orderBy: [{ subtotal: desc }]) {
        id
        productId
        name
        qty
        price
        subtotal
      }
    }
  }
`;

const getEndpoint = () =>
  process.env.KEYSTONE_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
  "http://localhost:3000/api/graphql";

export const fetchCloseReports = async ({
  take = 90,
}: {
  take?: number;
} = {}): Promise<CloseReportsPayload> => {
  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
    body: JSON.stringify({
      query: CLOSE_REPORTS_QUERY,
      variables: { take },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Close reports query failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as GraphQLResponse<{
    dailyCloses: CloseReport[];
  }>;

  if (payload.errors?.length) {
    throw new Error(
      payload.errors[0]?.message ?? "Unknown close reports GraphQL error",
    );
  }

  return {
    reports: payload.data?.dailyCloses ?? [],
  };
};
