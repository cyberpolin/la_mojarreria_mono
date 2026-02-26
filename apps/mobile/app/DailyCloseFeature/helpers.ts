import dayjs from "dayjs";
import { DailyClose } from "./Types";

export const getNewestCloseDate = (
  closesByDate: Record<string, DailyClose>,
): string | null => {
  const dates = Object.keys(closesByDate || {});
  if (dates.length === 0) return null;

  // YYYY-MM-DD compara lexicográficamente, pero usamos dayjs por seguridad.
  return dates.sort((a, b) => dayjs(a).valueOf() - dayjs(b).valueOf())[
    dates.length - 1
  ];
};

export const needsSync = (
  closesByDate: Record<string, DailyClose>,
  lastSyncedDate?: string,
): boolean => {
  const newest = getNewestCloseDate(closesByDate);
  if (!newest) return false; // nothing to sync
  if (!lastSyncedDate) return true;
  return dayjs(newest).isAfter(dayjs(lastSyncedDate));
};
