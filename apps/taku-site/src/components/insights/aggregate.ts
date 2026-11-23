export type PeriodKind = "7d" | "30d" | "12m";

export type DateRange = {
  start: string;
  end: string;
};

export type InsightDayClose = {
  id: string;
  dayKey: string;
  expectedEfectivo: number;
  expectedBanco: number;
  expectedTotal: number;
  extraGastos: number;
  orderCount: number;
  mojarras: number;
  empanadas: number;
};

export type InsightExpense = {
  id: string;
  date: string;
  concept: string;
  amount: number;
};

export type InsightWeekClose = {
  id: string;
  weekStart: string;
  weekEnd: string;
  mojarraCost: number;
  platos: number;
  gas: number;
  aceite: number;
  raya: number;
  publi: number;
  comidaVerduras: number;
  otros: number;
  neto: number;
};

export type InsightTotals = {
  ingresos: number;
  gastos: number;
  neto: number;
  pedidos: number;
  ticket: number | null;
  efectivo: number;
  banco: number;
  mojarras: number;
  empanadas: number;
};

export type InsightBucket = {
  key: string;
  label: string;
  ingresos: number;
  gastos: number;
  neto: number;
};

export type InsightShare = {
  name: string;
  label: string;
  amount: number;
  percent: number;
};

export type InsightMovement = {
  id: string;
  date: string;
  kind: "ingreso" | "gasto";
  label: string;
  amount: number;
};

export type InsightReport = {
  range: DateRange;
  previous: DateRange;
  totals: InsightTotals;
  previousTotals: InsightTotals;
  buckets: InsightBucket[];
  expenseShares: InsightShare[];
  paymentShares: InsightShare[];
  productShares: InsightShare[];
  weekShares: InsightShare[];
  weekCount: number;
  weekNeto: number;
  movements: InsightMovement[];
  hasFlow: boolean;
};

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEK_CATEGORIES = [
  ["mojarraCost", "Mojarra"],
  ["platos", "Platos"],
  ["gas", "Gas"],
  ["aceite", "Aceite"],
  ["raya", "Raya"],
  ["publi", "Publicidad"],
  ["comidaVerduras", "Comida y verduras"],
  ["otros", "Otros"],
] as const;

export function money(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseDateKey(dayKey: string) {
  const match = DATE_KEY.exec(dayKey);
  if (!match) return null;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

export function formatDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dayKey: string, amount: number) {
  const date = parseDateKey(dayKey);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDateKey(date);
}

export function daysInclusive(start: string, end: string) {
  const from = parseDateKey(start);
  const to = parseDateKey(end);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

export function todayDateKey(
  now = new Date(),
  timeZone = "America/Mexico_City",
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function periodRange(kind: PeriodKind, today: string): DateRange {
  if (!parseDateKey(today)) return { start: today, end: today };
  if (kind === "7d") return { start: addDays(today, -6) ?? today, end: today };
  if (kind === "30d") {
    return { start: addDays(today, -29) ?? today, end: today };
  }
  const start = parseDateKey(today);
  if (!start) return { start: today, end: today };
  start.setUTCMonth(start.getUTCMonth() - 11);
  start.setUTCDate(1);
  return { start: formatDateKey(start), end: today };
}

export function previousRange(range: DateRange): DateRange {
  const length = daysInclusive(range.start, range.end);
  const end = addDays(range.start, -1) ?? range.start;
  const start = addDays(end, -(Math.max(length, 1) - 1)) ?? end;
  return { start, end };
}

function inRange(dayKey: string, range: DateRange) {
  return (
    Boolean(parseDateKey(dayKey)) &&
    dayKey >= range.start &&
    dayKey <= range.end
  );
}

function eachDay(range: DateRange) {
  const days: string[] = [];
  let cursor: string | null = range.start;
  while (cursor && cursor <= range.end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

function eachMonth(range: DateRange) {
  const months: string[] = [];
  const start = parseDateKey(`${range.start.slice(0, 7)}-01`);
  const endMonth = range.end.slice(0, 7);
  if (!start) return months;
  while (formatDateKey(start).slice(0, 7) <= endMonth) {
    months.push(formatDateKey(start).slice(0, 7));
    start.setUTCMonth(start.getUTCMonth() + 1);
  }
  return months;
}

function axisLabel(key: string) {
  if (key.length === 7) return `${key.slice(5)}/${key.slice(2, 4)}`;
  return key.slice(8);
}

function shares(
  rows: Array<{ name: string; amount: number }>,
  options?: { keepZeros?: boolean },
): InsightShare[] {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  if (total <= 0) return [];
  return rows
    .filter((row) => (options?.keepZeros ? true : row.amount > 0))
    .map((row) => ({
      name: row.name,
      label: row.name.length > 18 ? `${row.name.slice(0, 17)}…` : row.name,
      amount: money(row.amount),
      percent: Math.round((row.amount / total) * 100),
    }))
    .sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name));
}

export function totalsFor(
  days: InsightDayClose[],
  expenses: InsightExpense[],
  range: DateRange,
): InsightTotals {
  let ingresos = 0;
  let gastos = 0;
  let pedidos = 0;
  let efectivo = 0;
  let banco = 0;
  let mojarras = 0;
  let empanadas = 0;
  for (const day of days) {
    if (!inRange(day.dayKey, range)) continue;
    ingresos += day.expectedTotal;
    gastos += day.extraGastos;
    pedidos += day.orderCount;
    efectivo += day.expectedEfectivo;
    banco += day.expectedBanco;
    mojarras += day.mojarras;
    empanadas += day.empanadas;
  }
  for (const expense of expenses) {
    if (!inRange(expense.date, range)) continue;
    gastos += expense.amount;
  }
  ingresos = money(ingresos);
  gastos = money(gastos);
  return {
    ingresos,
    gastos,
    neto: money(ingresos - gastos),
    pedidos,
    ticket: pedidos > 0 ? money(ingresos / pedidos) : null,
    efectivo: money(efectivo),
    banco: money(banco),
    mojarras,
    empanadas,
  };
}

function expenseConceptRows(expenses: InsightExpense[], range: DateRange) {
  const grouped = new Map<string, { name: string; amount: number }>();
  for (const expense of expenses) {
    if (!inRange(expense.date, range)) continue;
    const name = expense.concept.trim() || "Sin concepto";
    const key = name.toLocaleLowerCase("es-MX");
    const current = grouped.get(key);
    if (current) current.amount += expense.amount;
    else grouped.set(key, { name, amount: expense.amount });
  }
  return [...grouped.values()];
}

function overlappingWeeks(weeks: InsightWeekClose[], range: DateRange) {
  return weeks.filter((week) => {
    const end = parseDateKey(week.weekEnd)
      ? week.weekEnd
      : addDays(week.weekStart, 6);
    if (!end || !parseDateKey(week.weekStart)) return false;
    return week.weekStart <= range.end && end >= range.start;
  });
}

function weekCategoryRows(weeks: InsightWeekClose[]) {
  return WEEK_CATEGORIES.map(([key, name]) => ({
    name,
    amount: weeks.reduce((sum, week) => sum + week[key], 0),
  }));
}

function movementsFor(
  days: InsightDayClose[],
  expenses: InsightExpense[],
  range: DateRange,
): InsightMovement[] {
  const rows: InsightMovement[] = [];
  for (const day of days) {
    if (!inRange(day.dayKey, range)) continue;
    if (day.expectedTotal !== 0) {
      rows.push({
        id: `${day.id}:ingreso`,
        date: day.dayKey,
        kind: "ingreso",
        label: "Cierre del dia",
        amount: money(day.expectedTotal),
      });
    }
    if (day.extraGastos !== 0) {
      rows.push({
        id: `${day.id}:extra`,
        date: day.dayKey,
        kind: "gasto",
        label: "Gastos extra del cierre",
        amount: money(day.extraGastos),
      });
    }
  }
  for (const expense of expenses) {
    if (!inRange(expense.date, range)) continue;
    rows.push({
      id: expense.id,
      date: expense.date,
      kind: "gasto",
      label: expense.concept.trim() || "Sin concepto",
      amount: money(expense.amount),
    });
  }
  return rows.sort((left, right) => {
    if (left.date !== right.date) return right.date.localeCompare(left.date);
    if (left.kind !== right.kind) return left.kind === "ingreso" ? -1 : 1;
    return left.label.localeCompare(right.label, "es");
  });
}

export function buildInsightReport(input: {
  today: string;
  period: PeriodKind;
  days: InsightDayClose[];
  expenses: InsightExpense[];
  weeks: InsightWeekClose[];
}): InsightReport {
  const range = periodRange(input.period, input.today);
  const previous = previousRange(range);
  const totals = totalsFor(input.days, input.expenses, range);
  const previousTotals = totalsFor(input.days, input.expenses, previous);
  const keys =
    input.period === "12m" ? eachMonth(range) : eachDay(range);
  const buckets = keys.map((key) => ({
    key,
    label: axisLabel(key),
    ingresos: 0,
    gastos: 0,
    neto: 0,
  }));
  const bucketOf = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  const bucketKey = (dayKey: string) =>
    input.period === "12m" ? dayKey.slice(0, 7) : dayKey;

  for (const day of input.days) {
    if (!inRange(day.dayKey, range)) continue;
    const bucket = bucketOf.get(bucketKey(day.dayKey));
    if (!bucket) continue;
    bucket.ingresos += day.expectedTotal;
    bucket.gastos += day.extraGastos;
  }
  for (const expense of input.expenses) {
    if (!inRange(expense.date, range)) continue;
    const bucket = bucketOf.get(bucketKey(expense.date));
    if (!bucket) continue;
    bucket.gastos += expense.amount;
  }
  for (const bucket of buckets) {
    bucket.ingresos = money(bucket.ingresos);
    bucket.gastos = money(bucket.gastos);
    bucket.neto = money(bucket.ingresos - bucket.gastos);
  }

  const weeks = overlappingWeeks(input.weeks, range);
  const payment = shares(
    [
      { name: "Efectivo", amount: totals.efectivo },
      { name: "Banco", amount: totals.banco },
    ],
    { keepZeros: true },
  );
  const products = shares(
    [
      { name: "Mojarras", amount: totals.mojarras },
      { name: "Empanadas", amount: totals.empanadas },
    ],
    { keepZeros: true },
  );

  return {
    range,
    previous,
    totals,
    previousTotals,
    buckets,
    expenseShares: shares(expenseConceptRows(input.expenses, range)),
    paymentShares: payment,
    productShares: products,
    weekShares: shares(weekCategoryRows(weeks)),
    weekCount: weeks.length,
    weekNeto: money(weeks.reduce((sum, week) => sum + week.neto, 0)),
    movements: movementsFor(input.days, input.expenses, range),
    hasFlow: totals.ingresos !== 0 || totals.gastos !== 0,
  };
}
