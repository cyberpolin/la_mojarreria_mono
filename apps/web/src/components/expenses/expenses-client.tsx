"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppCard, MetricCard } from "@/components/ui/card";
import { CloseReportsPayload } from "@/types/close-report";
import { DailyExpenseRecord, ExpensesPayload } from "@/types/expense";

const CACHE_KEY = "MOJARRERIA_EXPENSES_CACHE_V1";
const CONCEPT_OPTIONS = ["Mojarras", "Verduras", "gas", "aceite"];
const MOJARRAS_CONCEPT = "mojarras";
const MOJARRAS_QUANTITY_LABEL = "Mojarras quantity";

const todayISO = () => new Date().toISOString().slice(0, 10);
const toMoney = (value: number) => `$${(value / 100).toFixed(2)}`;
const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const isMojarrasConcept = (value: string) =>
  normalizeName(value) === MOJARRAS_CONCEPT;
const getMojarrasQuantityFromNotes = (notes: string) => {
  const match = notes.match(/Mojarras quantity:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
};
const buildExpenseNotes = (notes: string, quantity: string) => {
  const trimmedNotes = notes.trim();
  const trimmedQuantity = quantity.trim();
  if (!trimmedQuantity) return trimmedNotes;
  return [trimmedNotes, `${MOJARRAS_QUANTITY_LABEL}: ${trimmedQuantity}`]
    .filter(Boolean)
    .join("\n");
};

const initialForm = () => ({
  date: todayISO(),
  concept: "",
  amount: "",
  quantity: "",
  notes: "",
});

export function ExpensesClient() {
  const [expenses, setExpenses] = useState<DailyExpenseRecord[]>([]);
  const [soldMojarras, setSoldMojarras] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const loadExpenses = async () => {
    setLoading(true);
    setError(null);

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const payload = JSON.parse(cached) as ExpensesPayload;
      setExpenses(payload.expenses);
      setFromCache(true);
    }

    try {
      const response = await fetch("/api/expenses?limit=100", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Expenses request failed (${response.status})`);
      }
      const payload = (await response.json()) as ExpensesPayload;
      setExpenses(payload.expenses);
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      setFromCache(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const loadMojarraSales = async () => {
    try {
      const response = await fetch("/api/close-reports?limit=365", {
        cache: "no-store",
      });
      if (!response.ok) return;

      const payload = (await response.json()) as CloseReportsPayload;
      const sold = payload.reports.reduce((total, report) => {
        return (
          total +
          report.items.reduce((itemTotal, item) => {
            return normalizeName(item.name).includes(MOJARRAS_CONCEPT)
              ? itemTotal + item.qty
              : itemTotal;
          }, 0)
        );
      }, 0);
      setSoldMojarras(sold);
    } catch {
      setSoldMojarras(0);
    }
  };

  useEffect(() => {
    loadExpenses();
    loadMojarraSales();
  }, []);

  const todayTotal = useMemo(
    () =>
      expenses
        .filter((expense) => expense.date === todayISO())
        .reduce((sum, expense) => sum + expense.amountCents, 0),
    [expenses],
  );

  const listTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    [expenses],
  );

  const boughtMojarras = useMemo(
    () =>
      expenses
        .filter((expense) => isMojarrasConcept(expense.concept))
        .reduce(
          (sum, expense) => sum + getMojarrasQuantityFromNotes(expense.notes),
          0,
        ),
    [expenses],
  );
  const existingMojarras = boughtMojarras - soldMojarras;
  const mojarrasWarning = existingMojarras < 11;
  const shouldAskMojarrasQuantity = isMojarrasConcept(form.concept);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (shouldAskMojarrasQuantity && Number(form.quantity) <= 0) {
        throw new Error("Mojarras quantity is required.");
      }

      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          concept: form.concept,
          amount: form.amount,
          notes: shouldAskMojarrasQuantity
            ? buildExpenseNotes(form.notes, form.quantity)
            : form.notes,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? `Save failed (${response.status})`);
      }

      setForm((current) => ({
        ...initialForm(),
        date: current.date || todayISO(),
      }));
      setMessage("Expense saved.");
      await loadExpenses();
      await loadMojarraSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-4 mt-4 w-auto max-w-6xl p-3 md:mx-auto md:mt-0 md:w-full md:px-6 md:py-8">
      <div className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 md:left-4 md:top-4">
        <div
          aria-label={`${existingMojarras} mojarras remaining`}
          className={`flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-base font-bold shadow-lg ${
            mojarrasWarning
              ? "border-slate-200 bg-slate-100 text-slate-950 shadow-slate-950/40"
              : "border-slate-700 bg-slate-900 text-slate-50 shadow-black/30"
          }`}
        >
          {existingMojarras}
        </div>
      </div>

      {error ? (
        <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          <p className="font-medium text-slate-100">Expense issue</p>
          <p>{error}</p>
          {fromCache ? (
            <p className="mt-1 text-slate-300">Showing cached expenses.</p>
          ) : null}
        </section>
      ) : null}

      {message ? (
        <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100">
          {message}
        </section>
      ) : null}

      <section className="md:grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <AppCard className="md:grid">
          <h2 className="text-lg font-semibold text-slate-100">New Expense</h2>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Date
              <input
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                required
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Concept
              <input
                list="expense-concepts"
                value={form.concept}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    concept: event.target.value,
                    quantity: isMojarrasConcept(event.target.value)
                      ? current.quantity
                      : "",
                  }))
                }
                required
                placeholder="Mojarras, Verduras, gas, aceite"
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
              <datalist id="expense-concepts">
                {CONCEPT_OPTIONS.map((concept) => (
                  <option key={concept} value={concept} />
                ))}
              </datalist>
            </label>

            {shouldAskMojarrasQuantity ? (
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Quantity
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  required
                  placeholder="How many mojarras?"
                  className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
                />
              </label>
            ) : null}

            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Amount
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                required
                placeholder="0.00"
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Notes
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={4}
                placeholder="Optional"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="h-11 w-full rounded-lg border border-slate-600 bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Expense"}
            </button>
          </form>
        </AppCard>

        <div className="grid gap-5">
          <section className="md:grid gap-3 sm:grid-cols-3">
            <MetricCard
              title="Today"
              value={toMoney(todayTotal)}
              className="md:grid"
            />
            <MetricCard
              title="Latest Total"
              value={toMoney(listTotal)}
              className="md:grid"
            />
            <MetricCard
              title="Entries"
              value={String(expenses.length)}
              className="md:grid"
            />
            <MetricCard
              title="Existing Mojarras"
              value={String(existingMojarras)}
              className="md:grid"
            />
          </section>

          <AppCard className="md:grid">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-100">
                Latest Expenses
              </h2>
              {loading ? (
                <span className="text-xs text-slate-400">Loading...</span>
              ) : null}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Concept</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                    <th className="px-2 py-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="whitespace-nowrap px-2 py-3 text-slate-100">
                        {expense.date}
                      </td>
                      <td className="px-2 py-3 font-medium text-slate-100">
                        {expense.concept}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-right text-slate-100">
                        {toMoney(expense.amountCents)}
                      </td>
                      <td className="px-2 py-3 text-slate-300">
                        {expense.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!loading && expenses.length === 0 ? (
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                No expenses yet.
              </div>
            ) : null}
          </AppCard>
        </div>
      </section>
    </main>
  );
}
