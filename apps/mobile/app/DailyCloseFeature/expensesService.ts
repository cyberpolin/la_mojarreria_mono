import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG } from "@/constants/config";

const STORAGE_KEY = "MOJARRERIA_DAILY_EXPENSES_V1";
const SESSION_KEY = "MOJARRERIA_RESTAURANT_SESSION_V1";

export type DailyExpense = {
  id: string;
  date: string;
  concept: string;
  amountCents: number;
  notes: string;
  createdAt: string;
  synced: boolean;
};

type ApiPayload<T> = {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

type RestaurantSession = {
  accessToken: string;
};

type RemoteExpense = {
  id: string;
  date: string;
  concept: string;
  amountCents: number;
  createdAt?: string | null;
};

const todayISO = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const pesosToCents = (value: string) => {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
};

export const centsToMoney = (cents: number) =>
  `$${(Number(cents || 0) / 100).toFixed(2)}`;

const sortExpenses = (items: DailyExpense[]) =>
  [...items].sort((left, right) => {
    const byDate = right.date.localeCompare(left.date);
    if (byDate !== 0) return byDate;
    return right.createdAt.localeCompare(left.createdAt);
  });

async function readSession(): Promise<RestaurantSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RestaurantSession>;
    if (typeof parsed.accessToken !== "string" || !parsed.accessToken) {
      return null;
    }
    return { accessToken: parsed.accessToken };
  } catch {
    return null;
  }
}

async function writeSession(session: RestaurantSession) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

async function deviceLogin() {
  const response = await fetch(
    `${APP_CONFIG.restaurantApiBaseUrl}/session/device`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        deviceId: APP_CONFIG.deviceId,
        deviceKey: APP_CONFIG.restaurantDeviceKey,
      }),
    },
  );
  const payload = (await response
    .json()
    .catch(() => null)) as ApiPayload<RestaurantSession> | null;
  const accessToken = payload?.data?.accessToken;
  if (!response.ok || !payload?.ok || !accessToken) {
    throw new Error(
      payload?.error?.message ?? "No se pudo autenticar el dispositivo.",
    );
  }
  const session = { accessToken };
  await writeSession(session);
  return session;
}

async function getAccessToken() {
  const existing = await readSession();
  if (existing) return existing.accessToken;
  const session = await deviceLogin();
  return session.accessToken;
}

async function restaurantApi<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${APP_CONFIG.restaurantApiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (response.status === 401 && retry) {
    await clearSession();
    return restaurantApi<T>(path, init, false);
  }
  const payload = (await response
    .json()
    .catch(() => null)) as ApiPayload<T> | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.error?.message ?? `Expenses request failed (${response.status}).`,
    );
  }
  if (payload.data === undefined) {
    throw new Error("No se recibieron datos de gastos.");
  }
  return payload.data;
}

export async function readLocalExpenses() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [] as DailyExpense[];
  try {
    const parsed = JSON.parse(raw) as DailyExpense[];
    return Array.isArray(parsed) ? sortExpenses(parsed) : [];
  } catch {
    return [];
  }
}

async function writeLocalExpenses(items: DailyExpense[]) {
  const next = sortExpenses(items);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function asExpense(row: RemoteExpense): DailyExpense {
  return {
    id: row.id,
    date: row.date,
    concept: row.concept,
    amountCents: Number(row.amountCents ?? 0),
    notes: "",
    createdAt: row.createdAt ?? new Date().toISOString(),
    synced: true,
  };
}

async function syncUnsynced(local: DailyExpense[]) {
  const pending = local.filter((item) => !item.synced);
  if (pending.length === 0) return local;

  let next = [...local];
  for (const item of pending) {
    try {
      const created = await restaurantApi<RemoteExpense>("/expenses", {
        method: "POST",
        body: JSON.stringify({
          date: item.date,
          concept: item.concept,
          amountCents: item.amountCents,
        }),
      });
      const remote = asExpense(created);
      next = next.map((row) => (row.id === item.id ? remote : row));
    } catch {
      // Keep local item queued for a later retry.
    }
  }
  return writeLocalExpenses(next);
}

export async function loadExpenses() {
  const local = await readLocalExpenses();
  const afterSync = await syncUnsynced(local);
  try {
    const remoteRows = (await restaurantApi<RemoteExpense[]>("/expenses")).map(
      asExpense,
    );
    const unsynced = afterSync.filter((item) => !item.synced);
    return writeLocalExpenses([...unsynced, ...remoteRows]);
  } catch (error) {
    if (afterSync.length > 0) return afterSync;
    throw error;
  }
}

export async function addExpense(input: { concept: string; amount: string }) {
  const concept = input.concept.trim();
  const amountCents = pesosToCents(input.amount);
  if (!concept) {
    throw new Error("El concepto es requerido.");
  }
  if (amountCents <= 0) {
    throw new Error("La cantidad debe ser mayor a 0.");
  }

  const localItem: DailyExpense = {
    id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    date: todayISO(),
    concept,
    amountCents,
    notes: "",
    createdAt: new Date().toISOString(),
    synced: false,
  };

  const local = await readLocalExpenses();
  await writeLocalExpenses([localItem, ...local]);

  try {
    const created = await restaurantApi<RemoteExpense>("/expenses", {
      method: "POST",
      body: JSON.stringify({
        date: localItem.date,
        concept: localItem.concept,
        amountCents: localItem.amountCents,
      }),
    });
    const remote = asExpense(created);
    const latest = await readLocalExpenses();
    return writeLocalExpenses(
      latest.map((item) => (item.id === localItem.id ? remote : item)),
    );
  } catch {
    return readLocalExpenses();
  }
}
