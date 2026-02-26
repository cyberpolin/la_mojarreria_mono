import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApolloClient, gql, NormalizedCacheObject } from "@apollo/client";
import { APP_CONFIG } from "@/constants/config";

const STORAGE_KEY = "MOJARRERIA_OPERATOR_CACHE_V1";

type RemoteDailyCloseOperator = {
  userId: string;
  name: string;
  phone: string;
  role: string | null;
  pin: string;
  active: boolean;
  raw: Record<string, unknown> | null;
};

export type CachedDailyCloseOperator = {
  userId: string;
  name: string;
  phone: string;
  role: string | null;
  pin: string;
  active: boolean;
  cachedAt: string;
  raw: Record<string, unknown> | null;
};

type CachePayload = {
  version: 1;
  updatedAt: string;
  lastFetchedAt: string;
  fingerprint: string;
  operators: CachedDailyCloseOperator[];
};

const BOOTSTRAP_OPERATOR: CachedDailyCloseOperator = {
  userId: APP_CONFIG.bootstrapTeamUser.userId,
  name: APP_CONFIG.bootstrapTeamUser.name,
  phone: APP_CONFIG.bootstrapTeamUser.phone,
  role: "ADMIN",
  pin: APP_CONFIG.bootstrapTeamUser.pin,
  active: true,
  cachedAt: "",
  raw: {
    source: "bootstrap_local",
  },
};

const DAILY_CLOSE_OPERATORS = gql`
  query DailyCloseOperators {
    dailyCloseOperators {
      userId
      name
      phone
      role
      pin
      active
      raw
    }
  }
`;

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const sortOperators = (operators: CachedDailyCloseOperator[]) =>
  [...operators].sort((a, b) => a.userId.localeCompare(b.userId));

const toFingerprint = (operators: CachedDailyCloseOperator[]) => {
  const stable = sortOperators(operators).map((operator) => ({
    userId: operator.userId,
    name: operator.name,
    phone: operator.phone,
    role: operator.role,
    pin: operator.pin,
    active: operator.active,
  }));
  return JSON.stringify(stable);
};

const readCache = async (): Promise<CachePayload> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const cachedAt = new Date().toISOString();
    const bootstrapOperator = { ...BOOTSTRAP_OPERATOR, cachedAt };
    const operators = [bootstrapOperator];
    return {
      version: 1,
      updatedAt: cachedAt,
      lastFetchedAt: "",
      fingerprint: toFingerprint(operators),
      operators,
    };
  }

  try {
    const parsed = JSON.parse(raw) as CachePayload;
    if (!Array.isArray(parsed.operators)) {
      const cachedAt = new Date().toISOString();
      const bootstrapOperator = { ...BOOTSTRAP_OPERATOR, cachedAt };
      const operators = [bootstrapOperator];
      return {
        version: 1,
        updatedAt: cachedAt,
        lastFetchedAt: "",
        fingerprint: toFingerprint(operators),
        operators,
      };
    }
    const normalized = sortOperators(parsed.operators);
    if (normalized.length === 0) {
      const cachedAt = new Date().toISOString();
      const bootstrapOperator = { ...BOOTSTRAP_OPERATOR, cachedAt };
      const operators = [bootstrapOperator];
      return {
        version: 1,
        updatedAt: cachedAt,
        lastFetchedAt: "",
        fingerprint: toFingerprint(operators),
        operators,
      };
    }

    return {
      version: 1,
      updatedAt: String(parsed.updatedAt ?? ""),
      lastFetchedAt: String(
        (parsed as Partial<CachePayload>).lastFetchedAt ?? "",
      ),
      fingerprint: String((parsed as Partial<CachePayload>).fingerprint ?? ""),
      operators: normalized,
    };
  } catch {
    const cachedAt = new Date().toISOString();
    const bootstrapOperator = { ...BOOTSTRAP_OPERATOR, cachedAt };
    const operators = [bootstrapOperator];
    return {
      version: 1,
      updatedAt: cachedAt,
      lastFetchedAt: "",
      fingerprint: toFingerprint(operators),
      operators,
    };
  }
};

const writeCache = async (payload: CachePayload) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const upsertCachedOperator = async (
  operator: Omit<CachedDailyCloseOperator, "cachedAt"> & { cachedAt?: string },
) => {
  const cache = await readCache();
  const cachedAt = operator.cachedAt ?? new Date().toISOString();
  const nextOperator: CachedDailyCloseOperator = {
    ...operator,
    cachedAt,
  };

  const nextOperators = cache.operators.filter(
    (item) => item.userId !== nextOperator.userId,
  );
  nextOperators.push(nextOperator);
  const normalized = sortOperators(nextOperators);

  await writeCache({
    version: 1,
    updatedAt: cachedAt,
    lastFetchedAt: cachedAt,
    fingerprint: toFingerprint(normalized),
    operators: normalized,
  });
};

export const getOperatorCacheSummary = async () => {
  const cache = await readCache();
  return {
    count: cache.operators.length,
    updatedAt: cache.updatedAt,
    lastFetchedAt: cache.lastFetchedAt,
    fingerprint: cache.fingerprint,
  };
};

export const getCachedOperators = async () => {
  const cache = await readCache();
  return sortOperators(cache.operators);
};

export const hasCachedOperators = async () => {
  const cache = await readCache();
  return cache.operators.some((operator) => operator.active);
};

export const findCachedOperatorForLogin = async (
  phone: string,
  pin: string,
) => {
  const cache = await readCache();
  const normalizedInputPhone = normalizePhone(phone);
  const match = cache.operators.find((operator) => {
    if (!operator.active) return false;
    return (
      normalizePhone(operator.phone) === normalizedInputPhone &&
      operator.pin === pin
    );
  });
  return match ?? null;
};

export const syncDailyCloseOperators = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
) => {
  const cache = await readCache();
  const fetchedAt = new Date().toISOString();
  const response = await apolloClient.query<{
    dailyCloseOperators: RemoteDailyCloseOperator[];
  }>({
    query: DAILY_CLOSE_OPERATORS,
    fetchPolicy: "network-only",
  });

  const operators = sortOperators(
    (response.data?.dailyCloseOperators ?? []).map((operator) => ({
      userId: String(operator.userId),
      name: String(operator.name),
      phone: String(operator.phone),
      role: operator.role ?? null,
      pin: String(operator.pin),
      active: Boolean(operator.active),
      cachedAt: fetchedAt,
      raw: operator.raw ?? null,
    })),
  );

  const nextFingerprint = toFingerprint(operators);
  const hasBootstrapSeed = cache.operators.some(
    (operator) =>
      operator.raw &&
      (operator.raw as Record<string, unknown>).source === "bootstrap_local",
  );

  if (cache.fingerprint === nextFingerprint && !hasBootstrapSeed) {
    if (cache.lastFetchedAt !== fetchedAt) {
      await writeCache({
        ...cache,
        lastFetchedAt: fetchedAt,
      });
    }
    return {
      operators: cache.operators,
      changed: false,
      updatedAt: cache.updatedAt,
      lastFetchedAt: fetchedAt,
    };
  }

  await writeCache({
    version: 1,
    updatedAt: fetchedAt,
    lastFetchedAt: fetchedAt,
    fingerprint: nextFingerprint,
    operators,
  });

  return {
    operators,
    changed: true,
    updatedAt: fetchedAt,
    lastFetchedAt: fetchedAt,
  };
};
