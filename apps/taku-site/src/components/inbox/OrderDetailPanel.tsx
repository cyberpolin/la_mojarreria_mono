"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { createConversation } from "./api";
import {
  digitsPhone,
  formatDate,
  mobileThreadPath,
  pathForConversation,
} from "./helpers";
import { orderFoodTotal } from "./orderMessages";
import {
  closeDeliveryOrder,
  orderStatus,
  type DeliveryOrder,
} from "./pendingOrders";
import {
  DELIVERY_BASE,
  DELIVERY_INCLUDED_KM,
  DELIVERY_PER_KM,
  EMPANADA_PRICE,
  MOJARRA_PRICE,
  formatMxn,
} from "./raiseOrder";

function modalHost() {
  return document.getElementById("taku-mobile-window") ?? document.body;
}

function Row({
  label,
  value,
  hint,
  onClick,
  disabled,
}: {
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <dt className="text-slate-500">
        {label}
        {hint ? (
          <span className="mt-1 block text-xs text-slate-400">{hint}</span>
        ) : null}
      </dt>
      <dd className="flex items-center justify-end gap-1 text-right font-semibold text-slate-950">
        {value}
        {onClick ? <span className="text-slate-400">›</span> : null}
      </dd>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex w-full justify-between gap-4 px-4 py-3 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="flex justify-between gap-4 px-4 py-3 text-sm">{inner}</div>
  );
}

function mapsUrl(order: DeliveryOrder) {
  if (
    typeof order.latitude === "number" &&
    typeof order.longitude === "number"
  ) {
    return `https://maps.google.com/?q=${order.latitude},${order.longitude}`;
  }
  return null;
}

export function OrderDetailPanel({
  order,
  onClose,
}: {
  order: DeliveryOrder;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [opening, setOpening] = useState<"customer" | "driver" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const host = typeof document !== "undefined" ? modalHost() : null;
  if (!host) return null;

  const closed = orderStatus(order) === "closed";
  const customerPhone = digitsPhone(order.customerPhone ?? "");
  const driverPhone = digitsPhone(order.assignedDriver?.phone ?? "");
  const driver =
    order.assignedDriver?.name || order.assignedDriver?.phone || "Sin asignar";
  const href = mapsUrl(order);

  async function openChat(phone: string, who: "customer" | "driver") {
    if (!phone || opening) return;
    setOpening(who);
    setError(null);
    try {
      const conversation = await createConversation({
        phoneNumber: phone,
        name:
          who === "driver"
            ? (order.assignedDriver?.name ?? undefined)
            : undefined,
        whatsappAccountId: order.whatsappAccountId ?? undefined,
      });
      onClose();
      if (pathname.startsWith("/conversation-mobile")) {
        const account = order.whatsappAccountId
          ? {
              id: order.whatsappAccountId,
              displayName: "",
              phoneNumber: null,
              status: "connected",
            }
          : null;
        router.push(mobileThreadPath(phone, account));
        return;
      }
      router.push(pathForConversation(conversation.id));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo abrir el chat.",
      );
      setOpening(null);
    }
  }
  const overlayClass =
    host.id === "taku-mobile-window"
      ? "absolute inset-0 z-[90] flex flex-col bg-white"
      : "fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4";

  return createPortal(
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
            aria-label="Regresar"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-950">
              Detalle del pedido
            </h2>
            <p className="text-xs text-slate-500">
              {closed ? "Cerrado" : "Abierto"}
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="px-4 py-3 text-sm text-slate-700">{error}</p>
          ) : null}
          <dl className="divide-y divide-slate-100">
            <Row
              label="Cliente"
              value={
                opening === "customer"
                  ? "Abriendo..."
                  : order.customerPhone || "-"
              }
              onClick={
                customerPhone
                  ? () => void openChat(customerPhone, "customer")
                  : undefined
              }
              disabled={opening !== null}
            />
            <Row
              label="Repartidor"
              value={opening === "driver" ? "Abriendo..." : driver}
              hint={
                order.assignedDriver?.phone && order.assignedDriver.name
                  ? order.assignedDriver.phone
                  : undefined
              }
              onClick={
                driverPhone
                  ? () => void openChat(driverPhone, "driver")
                  : undefined
              }
              disabled={opening !== null}
            />
            <Row
              label="Pago"
              value={
                order.payment === "transferencia" ? "Transferencia" : "Efectivo"
              }
            />
            <Row
              label="Kilometros"
              value={`${order.kilometers} km`}
              hint={
                order.extraKilometers > 0
                  ? `${formatMxn(DELIVERY_BASE)} + ${order.extraKilometers} km extra × ${formatMxn(DELIVERY_PER_KM)}`
                  : `${formatMxn(DELIVERY_BASE)} incluye ${DELIVERY_INCLUDED_KM} km`
              }
            />
            <Row label="Envio" value={formatMxn(order.delivery)} />
            <Row
              label="Mojarras"
              value={`${order.mojarras} · ${formatMxn(order.mojarraTotal)}`}
              hint={`${order.mojarras} × ${formatMxn(MOJARRA_PRICE)}`}
            />
            <Row
              label="Empanadas"
              value={`${order.empanadas} · ${formatMxn(order.empanadaTotal)}`}
              hint={`${order.empanadas} × ${formatMxn(EMPANADA_PRICE)}`}
            />
            <Row
              label="A pagar"
              value={
                order.payment === "transferencia"
                  ? formatMxn(0)
                  : formatMxn(orderFoodTotal(order))
              }
            />
            <Row
              label="A cobrar"
              value={
                order.payment === "transferencia"
                  ? formatMxn(order.delivery)
                  : formatMxn(order.total)
              }
            />
            <Row label="Total" value={formatMxn(order.total)} />
            <Row label="Creado" value={formatDate(order.createdAt)} />
            {order.assignedDriver?.assignedAt ? (
              <Row
                label="Asignado"
                value={formatDate(order.assignedDriver.assignedAt)}
              />
            ) : null}
          </dl>
          {href ? (
            <div className="px-4 py-4">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Abrir ubicacion en Maps
              </a>
            </div>
          ) : null}
        </div>

        {closed ? null : (
          <div className="border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => {
                closeDeliveryOrder(order.id);
                onClose();
              }}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 hover:border-slate-950"
            >
              Cerrar pedido
            </button>
          </div>
        )}
      </div>
    </div>,
    host,
  );
}
