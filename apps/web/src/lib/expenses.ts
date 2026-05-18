import { buildAuthHeaders } from "@/lib/web-auth.server";
import { DailyExpenseRecord, ExpensesPayload } from "@/types/expense";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const getEndpoint = () =>
  process.env.KEYSTONE_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
  "http://localhost:3000/api/graphql";

async function execute<T>(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed (${response.status})`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Unknown GraphQL error");
  }
  if (!payload.data) throw new Error("Missing data in GraphQL response");
  return payload.data;
}

const EXPENSES_QUERY = `
  query Expenses($take: Int!) {
    dailyExpenses(orderBy: [{ date: desc }, { createdAt: desc }], take: $take) {
      id
      date
      concept
      amountCents
      notes
      createdAt
      updatedAt
    }
  }
`;

const EXPENSES_BY_DATE_QUERY = `
  query ExpensesByDate($date: String!, $take: Int!) {
    dailyExpenses(
      where: { date: { equals: $date } }
      orderBy: [{ createdAt: desc }]
      take: $take
    ) {
      id
      date
      concept
      amountCents
      notes
      createdAt
      updatedAt
    }
  }
`;

export const getExpenses = async ({
  take = 100,
}: {
  take?: number;
} = {}): Promise<ExpensesPayload> => {
  const data = await execute<{ dailyExpenses: DailyExpenseRecord[] }>(
    EXPENSES_QUERY,
    { take },
  );

  return { expenses: data.dailyExpenses ?? [] };
};

export const getExpensesByDate = async ({
  date,
  take = 100,
}: {
  date: string;
  take?: number;
}): Promise<ExpensesPayload> => {
  const data = await execute<{ dailyExpenses: DailyExpenseRecord[] }>(
    EXPENSES_BY_DATE_QUERY,
    { date, take },
  );

  return { expenses: data.dailyExpenses ?? [] };
};

export const createExpense = async (input: {
  date: string;
  concept: string;
  amountCents: number;
  notes?: string;
}) => {
  const mutation = `
    mutation CreateDailyExpense($data: DailyExpenseCreateInput!) {
      createDailyExpense(data: $data) { id }
    }
  `;

  await execute(mutation, {
    data: {
      date: input.date,
      concept: input.concept.trim(),
      amountCents: input.amountCents,
      notes: input.notes?.trim() ?? "",
    },
  });
};
