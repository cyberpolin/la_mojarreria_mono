export type DailyExpenseRecord = {
  id: string;
  date: string;
  concept: string;
  amountCents: number;
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ExpensesPayload = {
  expenses: DailyExpenseRecord[];
};
