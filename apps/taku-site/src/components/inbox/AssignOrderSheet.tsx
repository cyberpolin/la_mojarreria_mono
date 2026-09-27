"use client";

import type { DeliveryOrder } from "./pendingOrders";
import { formatMxn } from "./raiseOrder";

export function AssignOrderSheet({
  order,
  customerNotified = true,
  onClose,
}: {
  order: DeliveryOrder;
  customerNotified?: boolean;
  onClose: () => void;
}) {
  const driver =
    order.assignedDriver?.name || order.assignedDriver?.phone || "repartidor";

  return (
    <div className="absolute inset-0 z-[70] flex items-end bg-slate-950/50 p-4">
      <div className="w-full overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-950">
            Pedido asignado
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Asignado a {driver}
            {customerNotified ? ". Se aviso al cliente." : "."}
          </p>
        </div>
        <dl className="divide-y divide-slate-100 px-4 py-1 text-sm">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-500">Pago</dt>
            <dd className="font-semibold text-slate-950">
              {order.payment === "transferencia" ? "Transferencia" : "Efectivo"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-500">Envio</dt>
            <dd className="font-semibold text-slate-950">
              {formatMxn(order.delivery)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-500">Total</dt>
            <dd className="font-semibold text-slate-950">
              {formatMxn(order.total)}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-12 w-full items-center border-t border-slate-100 px-4 text-left text-sm font-semibold text-slate-950 hover:bg-slate-50"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
