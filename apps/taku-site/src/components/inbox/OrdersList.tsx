"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  assignmentRemainingMs,
  formatAssignmentCountdown,
  isAssignmentCountdownWarning,
} from "./assignmentCountdown";
import { ConversationAvatar } from "./ConversationAvatar";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { isDriverInList, useKnownDriverPhones } from "./drivers";
import { INBOX_ORDER_PARAM, INBOX_TAB_PARAM, cx, formatTime } from "./helpers";
import {
  clearReturnOrder,
  orderIdFromSearch,
  readReturnOrderId,
} from "./inboxReturn";
import { KebabIcon, MobileContextMenu } from "./mobile-shell";
import {
  closeDeliveryOrder,
  orderNumber,
  orderStatus,
  type DeliveryOrder,
} from "./pendingOrders";
import { formatMxn } from "./raiseOrder";
import { useDeliveryOrders } from "./useDeliveryOrders";
import {
  currentWeekStart,
  formatWeekRange,
  groupOrdersByWeek,
  openWeeklyReport,
  withCurrentWeek,
} from "./weeklyReport";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="10"
        cy="10"
        r="7.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10 6.25V10l2.5 1.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now;
}

function hasLiveCountdown(order: DeliveryOrder) {
  return (
    orderStatus(order) === "open" && Boolean(order.assignedDriver?.assignedAt)
  );
}

function AssignmentCountdown({
  assignedAt,
  now,
}: {
  assignedAt: string;
  now: number;
}) {
  const remainingMs = assignmentRemainingMs(assignedAt, now);
  if (remainingMs == null) return null;
  const warning = isAssignmentCountdownWarning(remainingMs);
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 tabular-nums text-[11px] font-semibold",
        warning ? "text-red-600" : "text-slate-700",
      )}
    >
      <ClockIcon className="h-3.5 w-3.5" />
      {formatAssignmentCountdown(remainingMs)}
    </span>
  );
}

function matchesQuery(order: DeliveryOrder, query: string) {
  if (!query) return true;
  const haystack = [
    order.customerPhone,
    orderNumber(order.customerPhone),
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
  now,
  onOpen,
  onMenu,
}: {
  order: DeliveryOrder;
  now: number;
  onOpen: (order: DeliveryOrder) => void;
  onMenu: (order: DeliveryOrder) => void;
}) {
  const driverPhones = useKnownDriverPhones();
  const closed = orderStatus(order) === "closed";
  const assignedAt = order.assignedDriver?.assignedAt;
  const liveCountdown = hasLiveCountdown(order) && assignedAt;
  const driver =
    order.assignedDriver?.name || order.assignedDriver?.phone || "Sin asignar";
  const number = orderNumber(order.customerPhone);
  const label = number ? `#${number}` : order.customerPhone || "Pedido";

  return (
    <div className="flex w-full items-stretch border-b border-slate-100 bg-white">
      <button
        type="button"
        onClick={() => onOpen(order)}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <ConversationAvatar
          label={number || order.customerPhone || "Pedido"}
          isDriver={isDriverInList(driverPhones, order.assignedDriver?.phone)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-950">
              {label}
            </p>
            {liveCountdown ? (
              <AssignmentCountdown assignedAt={assignedAt} now={now} />
            ) : (
              <span className="shrink-0 tabular-nums text-[11px] text-slate-500">
                {formatTime(
                  order.dailyListedAt ?? assignedAt ?? order.createdAt,
                )}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-slate-500">
            {order.customerPhone ? `${order.customerPhone} · ` : ""}
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cx(
        "h-4 w-4 shrink-0 text-slate-500 transition-transform",
        open && "rotate-90",
      )}
    >
      <path
        d="M7 4.5L13 10l-6 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function initialOpenWeeks(
  weeks: { weekStart: string; orders: DeliveryOrder[] }[],
  thisWeek: string,
) {
  const open = new Set([thisWeek]);
  const latestWithOrders = weeks.find((week) => week.orders.length > 0);
  if (latestWithOrders) open.add(latestWithOrders.weekStart);
  return open;
}

export function OrdersList({
  query = "",
  detailsEnabled = true,
}: {
  query?: string;
  detailsEnabled?: boolean;
}) {
  const orders = useDeliveryOrders();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [menuOrder, setMenuOrder] = useState<DeliveryOrder | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [thisWeek] = useState(() => currentWeekStart());
  const [openWeeks, setOpenWeeks] = useState<Set<string> | null>(null);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => matchesQuery(order, needle));
  }, [orders, query]);
  const weeks = useMemo(() => {
    const grouped = groupOrdersByWeek(visible);
    return query.trim() ? grouped : withCurrentWeek(grouped);
  }, [visible, query]);
  const resolvedOpenWeeks = openWeeks ?? initialOpenWeeks(weeks, thisWeek);
  const now = useNow(visible.some(hasLiveCountdown));
  const openOrder = detailsEnabled
    ? (orders.find((order) => order.id === openOrderId) ?? null)
    : null;

  function writeOrderQuery(orderId: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (orderId) {
      next.set(INBOX_TAB_PARAM, "pedidos");
      next.set(INBOX_ORDER_PARAM, orderId);
    } else {
      next.delete(INBOX_ORDER_PARAM);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function openDetail(order: DeliveryOrder) {
    setOpenOrderId(order.id);
    writeOrderQuery(order.id);
  }

  function hideDetail() {
    setOpenOrderId(null);
  }

  function closeDetail() {
    clearReturnOrder();
    setOpenOrderId(null);
    if (orderIdFromSearch(searchParams)) writeOrderQuery(null);
  }

  useEffect(() => {
    if (!detailsEnabled) {
      setOpenOrderId(null);
      return;
    }
    const id = orderIdFromSearch(searchParams) || readReturnOrderId();
    if (id) setOpenOrderId(id);
  }, [detailsEnabled, searchParams]);

  function toggleWeek(weekStart: string) {
    setOpenWeeks((current) => {
      const next = new Set(current ?? initialOpenWeeks(weeks, thisWeek));
      if (next.has(weekStart)) next.delete(weekStart);
      else next.add(weekStart);
      return next;
    });
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      {weeks.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">
          {query.trim()
            ? "No hay pedidos para esa busqueda."
            : "No hay pedidos."}
        </p>
      ) : (
        weeks.map((week) => {
          const open = resolvedOpenWeeks.has(week.weekStart);
          const total = week.orders.reduce(
            (sum, order) => sum + order.total,
            0,
          );
          const current = week.weekStart === thisWeek;
          return (
            <section key={week.weekStart}>
              <div className="flex items-stretch border-b border-slate-200 bg-slate-50">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleWeek(week.weekStart)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-slate-100"
                >
                  <Chevron open={open} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {formatWeekRange(week.weekStart, week.weekEnd)}
                      {current ? " · Esta semana" : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {week.orders.length}{" "}
                      {week.orders.length === 1 ? "pedido" : "pedidos"}
                      {week.orders.length > 0 ? ` · ${formatMxn(total)}` : ""}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => openWeeklyReport(week.weekStart)}
                  className="min-h-11 shrink-0 px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100"
                >
                  Cierre
                </button>
              </div>
              {open ? (
                week.orders.length === 0 ? (
                  <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
                    No hay pedidos en esta semana.
                  </p>
                ) : (
                  week.orders.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      now={now}
                      onOpen={openDetail}
                      onMenu={setMenuOrder}
                    />
                  ))
                )
              ) : null}
            </section>
          );
        })
      )}
      {openOrder ? (
        <OrderDetailPanel
          order={openOrder}
          onClose={closeDetail}
          onLeaveToChat={hideDetail}
        />
      ) : null}
      {menuOrder ? (
        <MobileContextMenu
          title={
            orderNumber(menuOrder.customerPhone)
              ? `#${orderNumber(menuOrder.customerPhone)}`
              : menuOrder.customerPhone || "Pedido"
          }
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
