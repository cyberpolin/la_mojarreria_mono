import type { DailyExpense } from "../types.js";

export function parseAmountCents(input: {
  amount?: unknown;
  amountCents?: unknown;
}) {
  if (input.amountCents != null && input.amountCents !== "") {
    const cents = Number(input.amountCents);
    if (!Number.isFinite(cents) || cents <= 0 || !Number.isInteger(cents)) {
      return null;
    }
    return cents;
  }
  const amount = Number(
    typeof input.amount === "string"
      ? input.amount.trim().replace(",", ".")
      : input.amount,
  );
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function dailyExpenseView(item: DailyExpense) {
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    date: item.date,
    concept: item.concept,
    amountCents: item.amountCents,
    amount: Math.round(item.amountCents) / 100,
    createdByUserId: item.createdByUserId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function sortDailyExpenses(items: DailyExpense[]) {
  return [...items].sort((left, right) => {
    const byDate = right.date.localeCompare(left.date);
    if (byDate !== 0) return byDate;
    return right.createdAt.localeCompare(left.createdAt);
  });
}
