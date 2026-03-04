type FixedOperatingExpenseInput = {
  id: string;
  name: string;
  costCents: number;
  renewalDays: number;
  active: boolean;
};

type CalcRecurringFixedExpensesInput = {
  salesTotalCents: number;
  fixedExpenses: FixedOperatingExpenseInput[];
};

type CalcRecurringFixedExpensesOutput = {
  allocatedFixedExpensesCents: number;
  fixedExpenseRatioBps: number;
  breakdown: Record<
    string,
    {
      name: string;
      allocatedCents: number;
      renewalDays: number;
    }
  >;
};

export const calcRecurringFixedExpenses = ({
  salesTotalCents,
  fixedExpenses,
}: CalcRecurringFixedExpensesInput): CalcRecurringFixedExpensesOutput => {
  const breakdown: CalcRecurringFixedExpensesOutput["breakdown"] = {};
  let allocatedFixedExpensesCents = 0;

  for (const expense of fixedExpenses) {
    if (!expense.active) continue;
    if (expense.renewalDays <= 0) continue;
    if (expense.costCents <= 0) continue;

    const allocatedCents = Math.round(expense.costCents / expense.renewalDays);
    allocatedFixedExpensesCents += allocatedCents;
    breakdown[expense.id] = {
      name: expense.name,
      allocatedCents,
      renewalDays: expense.renewalDays,
    };
  }

  return {
    allocatedFixedExpensesCents,
    fixedExpenseRatioBps:
      salesTotalCents > 0
        ? Math.round((allocatedFixedExpensesCents / salesTotalCents) * 10000)
        : 0,
    breakdown,
  };
};
