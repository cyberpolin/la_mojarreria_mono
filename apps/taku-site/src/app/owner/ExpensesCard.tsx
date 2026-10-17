"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { takuApi, takuList } from "@/lib/taku-api";
import { Button, Field, Input } from "@/components/inbox/ui";

export type OwnerExpense = {
  id: string;
  date: string;
  concept: string;
  amount: number;
  amountCents: number;
  createdAt: string;
};

function todayDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function moneyText(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
    new Date(year, month - 1, day),
  );
}

export function ExpensesCard() {
  const [date, setDate] = useState(todayDateKey);
  const [items, setItems] = useState<OwnerExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | null>(null);
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [formDate, setFormDate] = useState(todayDateKey);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.amount, 0),
    [items],
  );

  const loadExpenses = useCallback(
    async (nextDate = date) => {
      setIsLoading(true);
      try {
        const rows = await takuList<OwnerExpense>(
          `/expenses?date=${encodeURIComponent(nextDate)}`,
        );
        setItems(rows);
        setError(null);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cargar los gastos.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [date],
  );

  useEffect(() => {
    void loadExpenses(date);
  }, [date, loadExpenses]);

  function openCreate() {
    setConcept("");
    setAmount("");
    setFormDate(date);
    setError(null);
    setMode("create");
  }

  async function save() {
    if (saving) return;
    const nextConcept = concept.trim();
    if (!nextConcept) {
      setError("El concepto es requerido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await takuApi<OwnerExpense>("/expenses", {
        method: "POST",
        body: JSON.stringify({
          concept: nextConcept,
          amount,
          date: formDate,
        }),
      });
      setMode(null);
      setDate(formDate);
      await loadExpenses(formDate);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el gasto.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: OwnerExpense) {
    if (deletingId) return;
    const confirmed = window.confirm(`Eliminar "${item.concept}"?`);
    if (!confirmed) return;
    setDeletingId(item.id);
    setError(null);
    try {
      await takuApi(`/expenses/${item.id}`, { method: "DELETE" });
      await loadExpenses();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo eliminar el gasto.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Gastos
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          <span aria-hidden="true">+</span>
          Agregar gasto
        </button>
      </div>

      <div className="mt-4">
        <Field label="Dia">
          <Input
            type="date"
            placeholder="YYYY-MM-DD"
            value={date}
            onChange={setDate}
          />
        </Field>
      </div>

      {isLoading ? (
        <div className="mt-5 flex min-h-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <span
            role="status"
            aria-label="Cargando gastos"
            className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950"
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No hay gastos el {dateLabel(date)}.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {item.concept}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {dateLabel(item.date)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold tabular-nums text-slate-950">
                  {moneyText(item.amount)}
                </p>
                <Button
                  variant="secondary"
                  disabled={deletingId === item.id}
                  onClick={() => void remove(item)}
                >
                  {deletingId === item.id ? "..." : "Eliminar"}
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-1 text-sm">
            <span className="font-medium text-slate-500">Total del dia</span>
            <span className="font-semibold tabular-nums text-slate-950">
              {moneyText(total)}
            </span>
          </div>
        </div>
      )}

      {error && !mode ? (
        <p className="mt-4 text-sm text-slate-700">{error}</p>
      ) : null}

      {mode ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-950">
              Agregar gasto
            </h2>
            <div className="mt-5 grid gap-4">
              <Field label="Concepto">
                <Input
                  placeholder="Hielo, gas, reparacion..."
                  value={concept}
                  onChange={setConcept}
                />
              </Field>
              <Field label="Cantidad">
                <Input
                  placeholder="0.00"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={setAmount}
                />
              </Field>
              <Field label="Fecha">
                <Input
                  type="date"
                  placeholder="YYYY-MM-DD"
                  value={formDate}
                  onChange={setFormDate}
                />
              </Field>
            </div>
            {error ? (
              <p className="mt-4 text-sm text-slate-700">{error}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setMode(null);
                  setError(null);
                }}
              >
                Cancelar
              </Button>
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
