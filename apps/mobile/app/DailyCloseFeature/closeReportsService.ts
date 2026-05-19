import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG } from "@/constants/config";

export type RemoteCloseReport = {
  id: string;
  date: string;
  deviceId: string;
  cashReceived: number;
  bankTransfersReceived: number;
  deliveryCashPaid: number;
  otherCashExpenses: number;
  totalFromItems: number;
  status: string;
  updatedAt: string | null;
};

export type CloseReportsCache = {
  fetchedAt: string;
  reports: RemoteCloseReport[];
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message?: string }[];
};

const STORAGE_KEY = "MOJARRERIA_MOBILE_CLOSE_REPORTS_V1";

const CLOSE_REPORTS_QUERY = `
  query MobileCloseReports($take: Int!) {
    dailyCloses(orderBy: [{ date: desc }], take: $take) {
      id
      date
      deviceId
      cashReceived
      bankTransfersReceived
      deliveryCashPaid
      otherCashExpenses
      totalFromItems
      status
      updatedAt
    }
  }
`;

export const readCachedCloseReports = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as CloseReportsCache;
};

export const fetchCloseReports = async (take = 30) => {
  const response = await fetch(`${APP_CONFIG.apiUrl}/api/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: CLOSE_REPORTS_QUERY,
      variables: { take },
    }),
  });

  const payload = (await response.json().catch(() => null)) as GraphQLResponse<{
    dailyCloses: RemoteCloseReport[];
  }> | null;

  if (!response.ok) {
    throw new Error(`Close reports request failed (${response.status}).`);
  }

  if (payload?.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Close reports failed.");
  }

  const cache = {
    fetchedAt: new Date().toISOString(),
    reports: payload?.data?.dailyCloses ?? [],
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  return cache;
};
