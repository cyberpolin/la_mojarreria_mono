type SyncLogType = "SYNC_DAILY_CLOSE" | "SYNC_OTHER";
type SyncLogStatus = "SUCCESS" | "FAILED";

type SyncLogRecord = {
  id: string;
  retryCount: number;
};

type SyncLogDelegate = {
  findFirst: (args: unknown) => Promise<SyncLogRecord | null>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

type SyncContext = {
  prisma: {
    syncLog: SyncLogDelegate;
  };
};

type LogSyncResultArgs = {
  context: SyncContext;
  type: SyncLogType;
  status: SyncLogStatus;
  deviceId: string;
  date?: string;
  rawId?: string;
  errorMessage?: string;
  payload?: unknown;
  logSuccess?: boolean;
  useRetryCounter?: boolean;
};

const MAX_STRING_LENGTH = 1000;
const MAX_DEPTH = 4;
const MAX_ITEMS = 30;

const truncateString = (value: string) => {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
};

const sanitizePayload = (value: unknown, depth = 0): unknown => {
  if (value == null) return value;

  if (typeof value === "string") return truncateString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[DepthLimited]";

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ITEMS)
      .map((item) => sanitizePayload(item, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_ITEMS,
    );
    return Object.fromEntries(
      entries.map(([key, val]) => [key, sanitizePayload(val, depth + 1)]),
    );
  }

  return String(value);
};

const isLogSuccessEnabled = (logSuccess: boolean | undefined) => {
  if (typeof logSuccess === "boolean") return logSuccess;
  return process.env.SYNC_LOG_SUCCESS === "true";
};

const isRetryCounterEnabled = (useRetryCounter: boolean | undefined) => {
  if (typeof useRetryCounter === "boolean") return useRetryCounter;
  return process.env.SYNC_LOG_USE_RETRY_COUNTER === "true";
};

export const logSyncResult = async ({
  context,
  type,
  status,
  deviceId,
  date,
  rawId,
  errorMessage,
  payload,
  logSuccess,
  useRetryCounter,
}: LogSyncResultArgs): Promise<void> => {
  try {
    if (status === "SUCCESS" && !isLogSuccessEnabled(logSuccess)) {
      return;
    }

    const payloadSnapshot =
      payload === undefined ? undefined : sanitizePayload(payload);
    const shouldUseRetryCounter = isRetryCounterEnabled(useRetryCounter);

    if (status === "FAILED" && shouldUseRetryCounter) {
      const previous = await context.prisma.syncLog.findFirst({
        where: {
          type,
          status: "FAILED",
          deviceId,
          date: date ?? "",
        },
        orderBy: [{ createdAt: "desc" }],
      });

      if (previous) {
        await context.prisma.syncLog.update({
          where: { id: previous.id },
          data: {
            rawId: rawId ?? "",
            errorMessage: errorMessage ?? "",
            payloadSnapshot: payloadSnapshot ?? null,
            retryCount: previous.retryCount + 1,
          },
        });
        return;
      }
    }

    await context.prisma.syncLog.create({
      data: {
        type,
        status,
        deviceId,
        date: date ?? "",
        rawId: rawId ?? "",
        errorMessage: errorMessage ?? "",
        payloadSnapshot: payloadSnapshot ?? null,
        retryCount: 0,
      },
    });
  } catch (error) {
    console.error("[SyncLog] best-effort logging failed", error);
  }
};
