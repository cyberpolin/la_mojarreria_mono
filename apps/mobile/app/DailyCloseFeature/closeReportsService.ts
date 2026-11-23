import AsyncStorage from "@react-native-async-storage/async-storage";
import { restaurantApi } from "./restaurantApi";

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

const STORAGE_KEY = "MOJARRERIA_MOBILE_CLOSE_REPORTS_V1";

export const readCachedCloseReports = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as CloseReportsCache;
};

export const fetchCloseReports = async (take = 30) => {
  const reports = (
    await restaurantApi<RemoteCloseReport[]>("/daily-closes")
  ).slice(0, take);
  const cache = {
    fetchedAt: new Date().toISOString(),
    reports,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  return cache;
};
