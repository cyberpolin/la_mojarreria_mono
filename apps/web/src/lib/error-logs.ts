import {
  ErrorLogEntry,
  ErrorLogFilters,
  ErrorLogResult,
} from "@/types/error-log";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const GRAPHQL_QUERY = `
  query SyncLogs($where: SyncLogWhereInput!, $take: Int, $skip: Int!) {
    syncLogs(where: $where, orderBy: [{ createdAt: desc }], take: $take, skip: $skip) {
      id
      createdAt
      type
      status
      deviceId
      date
      rawId
      errorMessage
      payloadSnapshot
      retryCount
    }
    syncLogsCount(where: $where)
  }
`;

type KeystoneResponse = {
  data?: {
    syncLogs: ErrorLogEntry[];
    syncLogsCount: number;
  };
  errors?: Array<{ message?: string }>;
};

const getKeystoneUrl = () => {
  return (
    process.env.KEYSTONE_GRAPHQL_URL ??
    process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
    ""
  );
};

const clampPage = (value: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;

const clampPageSize = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(value), MAX_PAGE_SIZE);
};

export const normalizeFilters = (
  input: Partial<ErrorLogFilters>,
): ErrorLogFilters => {
  return {
    page: clampPage(input.page ?? 1),
    pageSize: clampPageSize(input.pageSize ?? DEFAULT_PAGE_SIZE),
    status: input.status,
    type: input.type,
    deviceId: input.deviceId?.trim() || undefined,
    date: input.date?.trim() || undefined,
  };
};

export const getErrorLogs = async (
  rawFilters: Partial<ErrorLogFilters>,
): Promise<ErrorLogResult> => {
  const endpoint = getKeystoneUrl();
  const filters = normalizeFilters(rawFilters);

  if (!endpoint) {
    return {
      entries: [],
      total: 0,
      source: "unavailable",
      error:
        "Set KEYSTONE_GRAPHQL_URL or NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL to load logs.",
    };
  }

  const where: Record<string, unknown> = {};
  if (filters.status) where.status = { equals: filters.status };
  if (filters.type) where.type = { equals: filters.type };
  if (filters.deviceId) where.deviceId = { contains: filters.deviceId };
  if (filters.date) where.date = { equals: filters.date };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: GRAPHQL_QUERY,
        variables: {
          where,
          take: filters.pageSize,
          skip: (filters.page - 1) * filters.pageSize,
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        entries: [],
        total: 0,
        source: "unavailable",
        error: `Keystone request failed with status ${res.status}.`,
      };
    }

    const payload = (await res.json()) as KeystoneResponse;

    if (payload.errors?.length) {
      return {
        entries: [],
        total: 0,
        source: "unavailable",
        error:
          payload.errors[0]?.message ??
          "Unknown GraphQL error while loading logs.",
      };
    }

    return {
      entries: payload.data?.syncLogs ?? [],
      total: payload.data?.syncLogsCount ?? 0,
      source: "keystone",
    };
  } catch (error) {
    return {
      entries: [],
      total: 0,
      source: "unavailable",
      error:
        error instanceof Error ? error.message : "Unknown error loading logs.",
    };
  }
};
