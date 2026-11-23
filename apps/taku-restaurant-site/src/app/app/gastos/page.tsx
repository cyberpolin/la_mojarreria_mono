"use client";

import { FormEvent, useEffect, useState } from "react";
import { restaurantApi } from "@/lib/api";
import { Button, Card } from "@/components/ui";

type Expense = {
  id: string;
  date: string;
  concept: string;
  amountCents: number;
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function GastosPage() {
  const [items, setItems] = useState<Expense[]>([]);
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    void restaurantApi<Expense[]>("/expenses")
      .then(setItems)
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : "No se pudieron cargar.",
        );
      });
  };

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await restaurantApi("/expenses", {
        method: "POST",
        body: JSON.stringify({ concept, amount: Number(amount) }),
      });
      setConcept("");
      setAmount("");
      load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo guardar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <h2 className="text-lg font-semibold">Agregar gasto</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Concepto
            <input
              required
              value={concept}
              onChange={(event) => setConcept(event.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-slate-950"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Cantidad
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-slate-950"
            />
          </label>
          {error ? <p className="text-sm text-slate-700">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar gasto"}
          </Button>
        </form>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">Lista</h2>
        <div className="mt-4 grid gap-2">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">Aun no hay gastos.</p>
          ) : null}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold">{item.concept}</p>
                <p className="text-xs text-slate-500">{item.date}</p>
              </div>
              <p className="text-sm font-semibold">{money(item.amountCents)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
