"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useDeliveryOrders } from "./useDeliveryOrders";
import { WeeklyPnlForm } from "./WeeklyPnlForm";
import { addDayKey, formatWeekRange, orderWeekDayKey } from "./weeklyReport";

function reportHost() {
  return document.getElementById("taku-mobile-window") ?? document.body;
}

export function WeeklyReportPanel({
  weekStart,
  onClose,
}: {
  weekStart: string;
  onClose: () => void;
}) {
  const orders = useDeliveryOrders();
  const weekEnd = addDayKey(weekStart, 6);
  const weekOrders = useMemo(
    () =>
      orders.filter((order) => {
        const dayKey = orderWeekDayKey(order);
        return dayKey >= weekStart && dayKey <= weekEnd;
      }),
    [orders, weekStart, weekEnd],
  );
  const ingresos = weekOrders.reduce((sum, order) => sum + order.total, 0);
  const mojarrasVendidas = weekOrders.reduce(
    (sum, order) => sum + order.mojarras,
    0,
  );
  const host = typeof document !== "undefined" ? reportHost() : null;
  if (!host) return null;

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
              Cierre de la semana
            </h2>
            <p className="truncate text-xs text-slate-500">
              {formatWeekRange(weekStart, weekEnd)}
            </p>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pt-4">
          <WeeklyPnlForm
            weekStart={weekStart}
            ingresos={ingresos}
            mojarrasVendidas={mojarrasVendidas}
            showIntro={false}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(panel, host);
}
