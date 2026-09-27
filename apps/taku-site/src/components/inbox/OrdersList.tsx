"use client";

import { useMemo, useState } from "react";
import { ConversationAvatar } from "./ConversationAvatar";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { isDriverInList, useKnownDriverPhones } from "./drivers";
import { cx, formatTime } from "./helpers";
import { KebabIcon, MobileContextMenu } from "./mobile-shell";
import {
  closeDeliveryOrder,
  orderStatus,
  type DeliveryOrder,
} from "./pendingOrders";
import { formatMxn } from "./raiseOrder";
import { useDeliveryOrders } from "./useDeliveryOrders";

function matchesQuery(order: DeliveryOrder, query: string) {
  if (!query) return true;
  const haystack = [
    order.customerPhone,
    order.assignedDriver?.phone,
    order.assignedDriver?.name,
    order.payment,
    orderStatus(order) === "closed" ? "cerrado" : "abierto",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function OrderRow({
  order,
  onOpen,
  onMenu,
}: {
  order: DeliveryOrder;
  onOpen: (order: DeliveryOrder) => void;
  onMenu: (order: DeliveryOrder) => void;
}) {
  const driverPhones = useKnownDriverPhones();
  const closed = orderStatus(order) === "closed";
  const driver =
    order.assignedDriver?.name || order.assignedDriver?.phone || "Sin asignar";
  const label = order.customerPhone || "Pedido";

  return (
    <div className="flex w-full items-stretch border-b border-slate-100 bg-white">
      <button
        type="button"
        onClick={() => onOpen(order)}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <ConversationAvatar
          label={label}
          isDriver={isDriverInList(driverPhones, order.assignedDriver?.phone)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-950">
              {label}
            </p>
            <span className="shrink-0 tabular-nums text-[11px] text-slate-500">
              {formatTime(
                order.dailyListedAt ??
                  order.assignedDriver?.assignedAt ??
                  order.createdAt,
              )}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-slate-500">
            {driver} ·{" "}
            {order.payment === "transferencia" ? "Transferencia" : "Efectivo"} ·{" "}
            {formatMxn(order.total)}
          </p>
          <p
            className={cx(
              "mt-1 text-[11px] font-semibold",
              closed ? "text-slate-400" : "text-slate-700",
            )}
          >
            {closed ? "Cerrado" : "Abierto"}
          </p>
        </div>
      </button>
      {closed ? null : (
        <button
          type="button"
          aria-label="Opciones del pedido"
          onClick={() => onMenu(order)}
          className="grid w-12 shrink-0 place-items-center text-slate-500 hover:bg-slate-50"
        >
          <KebabIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function OrdersList({ query = "" }: { query?: string }) {
  const orders = useDeliveryOrders();
  const [menuOrder, setMenuOrder] = useState<DeliveryOrder | null>(null);
  const [openOrder, setOpenOrder] = useState<DeliveryOrder | null>(null);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => matchesQuery(order, needle));
  }, [orders, query]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      {visible.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">
          {query.trim()
            ? "No hay pedidos para esa busqueda."
            : "No hay pedidos."}
        </p>
      ) : null}
      {visible.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          onOpen={setOpenOrder}
          onMenu={setMenuOrder}
        />
      ))}
      {openOrder ? (
        <OrderDetailPanel
          order={openOrder}
          onClose={() => setOpenOrder(null)}
        />
      ) : null}
      {menuOrder ? (
        <MobileContextMenu
          title={menuOrder.customerPhone || "Pedido"}
          items={
            orderStatus(menuOrder) === "open"
              ? [
                  {
                    label: "Cerrar pedido",
                    onSelect: () => {
                      closeDeliveryOrder(menuOrder.id);
                    },
                  },
                ]
              : []
          }
          onClose={() => setMenuOrder(null)}
        />
      ) : null}
    </div>
  );
}
