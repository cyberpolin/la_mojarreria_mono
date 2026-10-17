import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dailyExpenseView,
  parseAmountCents,
  sortDailyExpenses,
} from "./dailyExpenses.js";
import type { DailyExpense } from "../types.js";

test("parses pesos into cents", () => {
  assert.equal(parseAmountCents({ amount: "12.5" }), 1250);
  assert.equal(parseAmountCents({ amount: "12,50" }), 1250);
});

test("accepts integer cents", () => {
  assert.equal(parseAmountCents({ amountCents: 199 }), 199);
});

test("rejects zero or invalid amounts", () => {
  assert.equal(parseAmountCents({ amount: 0 }), null);
  assert.equal(parseAmountCents({ amount: "abc" }), null);
  assert.equal(parseAmountCents({ amountCents: 12.5 }), null);
});

test("sorts expenses newest first", () => {
  const rows = [
    {
      id: "a",
      date: "2026-10-15",
      createdAt: "2026-10-15T12:00:00.000Z",
    },
    {
      id: "b",
      date: "2026-10-16",
      createdAt: "2026-10-16T10:00:00.000Z",
    },
    {
      id: "c",
      date: "2026-10-16",
      createdAt: "2026-10-16T18:00:00.000Z",
    },
  ] as DailyExpense[];
  assert.deepEqual(
    sortDailyExpenses(rows).map((item) => item.id),
    ["c", "b", "a"],
  );
});

test("expense view exposes pesos and cents", () => {
  const view = dailyExpenseView({
    id: "expense_1",
    workspaceId: "ws",
    date: "2026-10-16",
    concept: "Hielo",
    amountCents: 15000,
    createdByUserId: "user_1",
    createdAt: "2026-10-16T12:00:00.000Z",
    updatedAt: "2026-10-16T12:00:00.000Z",
  });
  assert.equal(view.amount, 150);
  assert.equal(view.amountCents, 15000);
});
