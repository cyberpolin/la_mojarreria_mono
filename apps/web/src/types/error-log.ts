export type SyncLogStatus = "SUCCESS" | "FAILED";
export type SyncLogType = "SYNC_DAILY_CLOSE" | "SYNC_OTHER";

export type ErrorLogEntry = {
  id: string;
  createdAt: string;
  type: SyncLogType;
  status: SyncLogStatus;
  deviceId: string;
  date: string | null;
  rawId: string | null;
  errorMessage: string | null;
  payloadSnapshot: unknown;
  retryCount: number;
};

export type ErrorLogFilters = {
  page: number;
  pageSize: number;
  status?: SyncLogStatus;
  type?: SyncLogType;
  deviceId?: string;
  date?: string;
};

export type ErrorLogResult = {
  entries: ErrorLogEntry[];
  total: number;
  source: "keystone" | "unavailable";
  error?: string;
};
