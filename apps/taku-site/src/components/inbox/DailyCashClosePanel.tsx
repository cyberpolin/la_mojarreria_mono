"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TakuApiError } from "@/lib/taku-api";
import { fetchDayClose, saveDayClose } from "./api";
import {
  canCloseDay,
  cashCloseDiferencia,
  daySales,
  formatCashDifference,
  formatDayLabel,
} from "./dayClose";
import { formatMxn, parseNonNegativeNumber } from "./raiseOrder";
import { Button, Field, Input } from "./ui";
import { useDeliveryOrders } from "./useDeliveryOrders";
import { notifyDayClosesChanged } from "./useDayCloses";
import { orderWeekDayKey } from "./weeklyReport";

function closeHost() {
  return document.getElementById("taku-mobile-window") ?? document.body;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-950">
        {value}
      </p>
    </div>
  );
}

export function DailyCashClosePanel({
  dayKey,
  onClose,
}: {
  dayKey: string;
  onClose: () => void;
}) {
  const orders = useDeliveryOrders();
  const dayOrders = useMemo(
    () => orders.filter((order) => orderWeekDayKey(order) === dayKey),
    [orders, dayKey],
  );
  const sales = daySales(dayOrders);
  const [alreadyClosed, setAlreadyClosed] = useState(false);
  const [efectivo, setEfectivo] = useState("");
  const [banco, setBanco] = useState("");
  const [extras, setExtras] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countedEfectivo = parseNonNegativeNumber(efectivo);
  const countedBanco = parseNonNegativeNumber(banco);
  const extraGastos = parseNonNegativeNumber(extras);
  const diferencia = cashCloseDiferencia({
    expectedTotal: sales.total,
    countedEfectivo,
    countedBanco,
    extraGastos,
  });
  const expectedAfterExtras =
    Math.round((sales.total - extraGastos) * 100) / 100;
  const countedTotal = Math.round((countedEfectivo + countedBanco) * 100) / 100;

  useEffect(() => {
    let cancelled = false;
    void fetchDayClose(dayKey)
      .then((close) => {
        if (cancelled || !close) return;
        setAlreadyClosed(true);
        setEfectivo(String(close.countedEfectivo ?? ""));
        setBanco(String(close.countedBanco ?? ""));
        setExtras(String(close.extraGastos ?? ""));
      })
      .catch(() => {
        if (!cancelled) setAlreadyClosed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dayKey]);

  const host = typeof document !== "undefined" ? closeHost() : null;
  if (!host) return null;
  if (!canCloseDay(dayKey)) return null;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await saveDayClose(dayKey, {
        expectedEfectivo: sales.efectivo,
        expectedBanco: sales.transferencia,
        expectedTotal: sales.total,
        countedEfectivo,
        countedBanco,
        extraGastos,
        orderCount: sales.orderCount,
        mojarras: sales.mojarras,
        empanadas: sales.empanadas,
      });
      notifyDayClosesChanged();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof TakuApiError
          ? caught.message
          : "No se pudo guardar el cierre de caja.",
      );
    } finally {
      setSaving(false);
    }
  }

  const overlayClass =
    host.id === "taku-mobile-window"
      ? "absolute inset-0 z-[90] flex flex-col bg-white"
      : "fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4";

  const panel = (
    <div className={overlayClass}>
      <div
        className={
          host.id === "taku-mobile-window"
            ? "flex min-h-0 flex-1 flex-col"
            : "flex h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        }
      >
        <header className="flex items-center gap-2 border-b border-slate-200 px-2 py-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center text-lg"
            aria-label="Cerrar"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-950">
              Cierre de caja
            </h2>
            <p className="truncate text-xs text-slate-500">
              {formatDayLabel(dayKey)}
              {alreadyClosed ? " · cerrada" : ""}
            </p>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Segun pedidos
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label="Efectivo" value={formatMxn(sales.efectivo)} />
            <Stat label="Banco" value={formatMxn(sales.transferencia)} />
            <Stat label="Total" value={formatMxn(sales.total)} />
            <Stat label="Pedidos" value={String(sales.orderCount)} />
          </div>

          <div className="mt-6 grid gap-4">
            <Field
              label="Cuanto hay en efectivo"
              hint={`Pedidos: ${formatMxn(sales.efectivo)}`}
            >
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                placeholder="0"
                value={efectivo}
                onChange={setEfectivo}
              />
            </Field>
            <Field
              label="Cuanto hay en banco"
              hint={`Pedidos: ${formatMxn(sales.transferencia)}`}
            >
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                placeholder="0"
                value={banco}
                onChange={setBanco}
              />
            </Field>
            <Field label="Gastos extras">
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                placeholder="0"
                value={extras}
                onChange={setExtras}
              />
            </Field>
          </div>

          <div className="mt-6 grid gap-2 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Diferencia
            </p>
            <p className="text-sm text-slate-700">
              Contado {formatMxn(countedTotal)} · esperado{" "}
              {formatMxn(expectedAfterExtras)}
            </p>
            <p className="text-base font-semibold tabular-nums text-slate-950">
              {formatCashDifference(diferencia)}
            </p>
            <p className="text-xs text-slate-500">
              Puedes cerrar aunque no cuadre. La diferencia se guarda.
            </p>
          </div>

          {error ? (
            <p className="mt-3 text-sm text-slate-700">{error}</p>
          ) : null}
          <div className="mt-4">
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                void submit();
              }}
            >
              {saving
                ? "Guardando..."
                : alreadyClosed
                  ? "Guardar cierre"
                  : "Cerrar caja"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, host);
}
