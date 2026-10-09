"use client";

import { useEffect, useState } from "react";
import { restaurantApi } from "@/lib/api";
import { Card } from "@/components/ui";

type CloseItem = {
  productId: string;
  name: string;
  priceCents: number;
  qty: number;
};

type CloseEvidence = {
  kind: string;
  takenAt: string;
  url?: string;
};

type DailyClose = {
  id: string;
  date: string;
  deviceId: string;
  items: CloseItem[];
  cashReceived: number;
  bankTransfersReceived: number;
  deliveryCashPaid: number;
  otherCashExpenses: number;
  notes: string;
  expectedTotal: number;
  evidence: CloseEvidence[];
  closedByName: string;
};

const money = (cents: number) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

const evidenceLabel: Record<string, string> = {
  bathroom_clean: "Baño limpio",
  bathroom_closed: "Baño cerrado",
  dining: "Comedor",
  trash: "Basura",
};

export default function CierrePage() {
  const [items, setItems] = useState<DailyClose[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void restaurantApi<DailyClose[]>("/daily-closes")
      .then(setItems)
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : "No se pudieron cargar.",
        );
      });
  }, []);

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-lg font-semibold">Cierre de caja</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          El operador captura en el movil. Aqui vive el historial sincronizado.
        </p>
        {error ? <p className="mt-3 text-sm text-slate-700">{error}</p> : null}
      </Card>
      {items.length === 0 && !error ? (
        <Card>
          <p className="text-sm text-slate-500">Aun no hay cierres.</p>
        </Card>
      ) : null}
      {items.map((close) => (
        <Card key={close.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">{close.date}</h3>
            <p className="text-sm font-semibold">
              Venta {money(close.expectedTotal)}
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {close.deviceId}
            {close.closedByName ? ` · ${close.closedByName}` : ""}
          </p>
          <div className="mt-4 grid gap-2">
            {close.items.map((item) => (
              <div
                key={`${close.id}-${item.productId}`}
                className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
              >
                <p className="text-sm font-semibold">
                  {item.qty} {item.name}
                </p>
                <p className="text-sm font-semibold">
                  {money(item.qty * item.priceCents)}
                </p>
              </div>
            ))}
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Caja</dt>
              <dd className="font-semibold">{money(close.cashReceived)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Depositos</dt>
              <dd className="font-semibold">
                {money(close.bankTransfersReceived)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Repartidores</dt>
              <dd className="font-semibold">{money(close.deliveryCashPaid)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Otros gastos</dt>
              <dd className="font-semibold">
                {money(close.otherCashExpenses)}
              </dd>
            </div>
          </dl>
          {close.evidence.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {close.evidence.map((item) => (
                <figure key={`${close.id}-${item.kind}`} className="grid gap-2">
                  {item.url ? (
                    <img
                      src={item.url}
                      alt={evidenceLabel[item.kind] ?? item.kind}
                      className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square place-items-center rounded-lg border border-slate-200 text-xs text-slate-500">
                      Sin foto
                    </div>
                  )}
                  <figcaption className="text-xs text-slate-500">
                    {evidenceLabel[item.kind] ?? item.kind}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          {close.notes ? (
            <p className="mt-3 text-sm text-slate-600">{close.notes}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
