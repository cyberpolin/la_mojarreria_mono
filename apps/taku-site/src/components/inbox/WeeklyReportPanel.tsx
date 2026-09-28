"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatMxn } from "./raiseOrder";
import { formatWeekRange, type WeeklyReport } from "./weeklyReport";

function reportHost() {
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

export function WeeklyReportPanel({
  report,
  saved,
  onClose,
}: {
  report: WeeklyReport;
  saved: boolean;
  onClose: () => void;
}) {
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
              Reporte de la semana
            </h2>
            <p className="truncate text-xs text-slate-500">
              {formatWeekRange(report.weekStart, report.weekEnd)}
              {saved ? "" : " · en curso"}
            </p>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 p-4">
            <Stat label="Pedidos" value={String(report.orderCount)} />
            <Stat label="Total" value={formatMxn(report.total)} />
            <Stat label="Mojarras" value={String(report.mojarras)} />
            <Stat label="Empanadas" value={String(report.empanadas)} />
            <Stat label="Envios" value={formatMxn(report.delivery)} />
            <Stat label="Efectivo" value={formatMxn(report.efectivo)} />
            <Stat
              label="Transferencia"
              value={formatMxn(report.transferencia)}
            />
          </div>
          {report.orders.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-slate-500">
              No hay pedidos en esta semana.
            </p>
          ) : (
            report.orders.map((order) => (
              <div
                key={order.id}
                className="border-t border-slate-100 px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {order.number ? `#${order.number}` : "Pedido"}
                  </p>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                    {formatMxn(order.total)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-slate-500">
                  {order.dayKey} · {order.driver} ·{" "}
                  {order.payment === "transferencia"
                    ? "Transferencia"
                    : "Efectivo"}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panel, host);
}
