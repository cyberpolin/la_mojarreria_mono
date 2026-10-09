import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG } from "@/constants/config";

const STORAGE_KEY = "MOJARRERIA_DAILY_EXPENSES_V1";

export type DailyExpense = {
  id: string;
  date: string;
  concept: string;
  amountCents: number;
  notes: string;
  createdAt: string;
  synced: boolean;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message?: string }[];
};

const EXPENSES_QUERY = `
  query MobileDailyExpenses($take: Int!) {
    dailyExpenses(orderBy: [{ date: desc }, { createdAt: desc }], take: $take) {
      id
      date
      concept
      amountCents
      notes
      createdAt
    }
  }
`;

const CREATE_EXPENSE_MUTATION = `
  mutation CreateDailyExpense($data: DailyExpenseCreateInput!) {
    createDailyExpense(data: $data) {
      id
      date
      concept
      amountCents
      notes
      createdAt
    }
  }
`;

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

async function graphql<T>(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(`${APP_CONFIG.apiUrl}/api/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = (await response
    .json()
    .catch(() => null)) as GraphQLResponse<T> | null;
  if (!response.ok) {
    throw new Error(`Expenses request failed (${response.status}).`);
  }
  if (payload?.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Expenses request failed.");
  }
  if (!payload?.data) {
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

function asExpense(row: {
  id: string;
  date: string;
  concept: string;
  amountCents: number;
  notes?: string | null;
  createdAt?: string | null;
}): DailyExpense {
  return {
    id: row.id,
    date: row.date,
    concept: row.concept,
    amountCents: Number(row.amountCents ?? 0),
    notes: row.notes ?? "",
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
      const created = await graphql<{
        createDailyExpense: Parameters<typeof asExpense>[0];
      }>(CREATE_EXPENSE_MUTATION, {
        data: {
          date: item.date,
          concept: item.concept,
          amountCents: item.amountCents,
          notes: item.notes,
        },
      });
      const remote = asExpense(created.createDailyExpense);
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
    const remote = await graphql<{
      dailyExpenses: Array<Parameters<typeof asExpense>[0]>;
    }>(EXPENSES_QUERY, { take: 200 });
    const remoteRows = (remote.dailyExpenses ?? []).map(asExpense);
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
    const created = await graphql<{
      createDailyExpense: Parameters<typeof asExpense>[0];
    }>(CREATE_EXPENSE_MUTATION, {
      data: {
        date: localItem.date,
        concept: localItem.concept,
        amountCents: localItem.amountCents,
        notes: "",
      },
    });
    const remote = asExpense(created.createDailyExpense);
    const latest = await readLocalExpenses();
    return writeLocalExpenses(
      latest.map((item) => (item.id === localItem.id ? remote : item)),
    );
  } catch {
    return readLocalExpenses();
  }
}
