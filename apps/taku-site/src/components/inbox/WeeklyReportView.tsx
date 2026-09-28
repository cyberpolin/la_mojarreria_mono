"use client";

import { useEffect, useState } from "react";
import { formatMxn } from "./raiseOrder";
import { ORDERS_CHANGED_EVENT } from "./pendingOrders";
import {
  ensureWeeklyReport,
  formatWeekRange,
  type WeeklyReport,
} from "./weeklyReport";

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

export function WeeklyReportView() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = ensureWeeklyReport();
      setReport(next.report);
      setSaved(next.saved);
    };
    sync();
    window.addEventListener(ORDERS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(ORDERS_CHANGED_EVENT, sync);
  }, []);

  if (!report) {
    return <p className="p-4 text-sm text-slate-500">Cargando reporte...</p>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="px-4 pt-4">
        <h2 className="text-base font-semibold text-slate-950">
          Reporte de la semana
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {formatWeekRange(report.weekStart, report.weekEnd)}
          {saved ? "" : " · en curso"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4">
        <Stat label="Pedidos" value={String(report.orderCount)} />
        <Stat label="Total" value={formatMxn(report.total)} />
        <Stat label="Mojarras" value={String(report.mojarras)} />
        <Stat label="Empanadas" value={String(report.empanadas)} />
        <Stat label="Envios" value={formatMxn(report.delivery)} />
        <Stat label="Efectivo" value={formatMxn(report.efectivo)} />
        <Stat label="Transferencia" value={formatMxn(report.transferencia)} />
      </div>
      {report.orders.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-slate-500">
          No hay pedidos en esta semana.
        </p>
      ) : (
        report.orders.map((order) => (
          <div key={order.id} className="border-t border-slate-100 px-4 py-3">
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
              {order.payment === "transferencia" ? "Transferencia" : "Efectivo"}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
