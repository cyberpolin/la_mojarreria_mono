import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInsightReport,
  daysInclusive,
  periodRange,
  previousRange,
  type InsightDayClose,
  type InsightExpense,
  type InsightWeekClose,
} from "./aggregate";

const today = "2026-11-23";

const day: InsightDayClose = {
  id: "day-20",
  dayKey: "2026-11-20",
  expectedEfectivo: 300,
  expectedBanco: 200,
  expectedTotal: 500,
  extraGastos: 20,
  orderCount: 2,
  mojarras: 4,
  empanadas: 1,
};

const expenses: InsightExpense[] = [
  { id: "hielo", date: "2026-11-21", concept: "Hielo", amount: 30 },
  { id: "gas-prev", date: "2026-11-10", concept: "Gas", amount: 100 },
];

const weeks: InsightWeekClose[] = [
  {
    id: "week-now",
    weekStart: "2026-11-16",
    weekEnd: "2026-11-22",
    mojarraCost: 0,
    platos: 0,
    gas: 80,
    aceite: 0,
    raya: 0,
    publi: 0,
    comidaVerduras: 0,
    otros: 0,
    neto: 400,
  },
  {
    id: "week-old",
    weekStart: "2026-01-05",
    weekEnd: "2026-01-11",
    mojarraCost: 0,
    platos: 0,
    gas: 999,
    aceite: 0,
    raya: 0,
    publi: 0,
    comidaVerduras: 0,
    otros: 0,
    neto: 1,
  },
];

test("12 months starts on the first day eleven months back", () => {
  assert.deepEqual(periodRange("12m", today), {
    start: "2025-12-01",
    end: today,
  });
  assert.deepEqual(periodRange("7d", today), {
    start: "2026-11-17",
    end: today,
  });
  const year = periodRange("12m", today);
  const prior = previousRange(year);
  assert.equal(daysInclusive(year.start, year.end), daysInclusive(prior.start, prior.end));
  assert.equal(prior.end, "2025-11-30");
});

test("buckets keep months that had no sales", () => {
  const report = buildInsightReport({
    today,
    period: "12m",
    days: [day],
    expenses,
    weeks: [],
  });
  assert.equal(report.buckets.length, 12);
  assert.equal(report.buckets[0]?.key, "2025-12");
  assert.equal(report.buckets[0]?.ingresos, 0);
  assert.equal(report.buckets[0]?.gastos, 0);
  const november = report.buckets.find((bucket) => bucket.key === "2026-11");
  assert.equal(november?.ingresos, 500);
  assert.equal(november?.gastos, 150);
  assert.equal(november?.neto, 350);
});

test("ticket is empty when the period has no orders", () => {
  const report = buildInsightReport({
    today,
    period: "7d",
    days: [{ ...day, dayKey: "2026-11-20", orderCount: 0, expectedTotal: 80 }],
    expenses: [],
    weeks: [],
  });
  assert.equal(report.totals.pedidos, 0);
  assert.equal(report.totals.ticket, null);
  assert.equal(report.totals.ingresos, 80);
});

test("weekly food cost stays out of the expense total", () => {
  const report = buildInsightReport({
    today,
    period: "7d",
    days: [day],
    expenses,
    weeks,
  });
  assert.equal(report.range.start, "2026-11-17");
  assert.equal(report.previous.start, "2026-11-10");
  assert.equal(report.totals.ingresos, 500);
  assert.equal(report.totals.gastos, 50);
  assert.equal(report.totals.neto, 450);
  assert.equal(report.totals.pedidos, 2);
  assert.equal(report.totals.ticket, 250);
  assert.equal(report.previousTotals.ingresos, 0);
  assert.equal(report.previousTotals.gastos, 100);
  assert.equal(report.previousTotals.ticket, null);
  assert.equal(report.weekCount, 1);
  assert.equal(report.weekShares.length, 1);
  assert.equal(report.weekShares[0]?.name, "Gas");
  assert.equal(report.weekShares[0]?.amount, 80);
  assert.equal(report.weekNeto, 400);
  assert.equal(report.buckets.length, 7);
  assert.equal(report.expenseShares[0]?.name, "Hielo");
  assert.equal(report.expenseShares[0]?.percent, 100);
  assert.deepEqual(
    report.movements.map((row) => [row.date, row.kind, row.amount]),
    [
      ["2026-11-21", "gasto", 30],
      ["2026-11-20", "ingreso", 500],
      ["2026-11-20", "gasto", 20],
    ],
  );
});
