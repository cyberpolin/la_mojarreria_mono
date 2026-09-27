"use client";

import { useMemo } from "react";
import { createPortal } from "react-dom";
import { formatTime } from "./helpers";
import {
  listTodayOrders,
  orderNumber,
  type DeliveryOrder,
} from "./pendingOrders";
import { formatMxn } from "./raiseOrder";

function orderHost() {
  return document.getElementById("taku-mobile-window") ?? document.body;
}

function OrderRow({ order }: { order: DeliveryOrder }) {
  const driver =
    order.assignedDriver?.name || order.assignedDriver?.phone || "-";
  return (
    <div className="border-b border-slate-100 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm font-semibold text-slate-950">
          {orderNumber(order.customerPhone)
            ? `#${orderNumber(order.customerPhone)}`
            : order.customerPhone || "Sin cliente"}
        </p>
        <span className="shrink-0 text-[11px] text-slate-500">
          {formatTime(order.dailyListedAt ?? order.createdAt)}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-slate-500">
        Repartidor {driver} ·{" "}
        {order.payment === "transferencia" ? "Transferencia" : "Efectivo"} ·{" "}
        {formatMxn(order.total)}
      </p>
    </div>
  );
}

export function DailyOrdersPanel({ onClose }: { onClose: () => void }) {
  const orders = useMemo(() => listTodayOrders(), []);
  const host = typeof document !== "undefined" ? orderHost() : null;
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
          <h2 className="text-base font-semibold text-slate-950">
            Pedidos del dia
          </h2>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {orders.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              Aun no hay pedidos asignados hoy.
            </p>
          ) : (
            orders.map((order) => <OrderRow key={order.id} order={order} />)
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panel, host);
}
