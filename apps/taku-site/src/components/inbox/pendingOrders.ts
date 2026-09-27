import { digitsPhone } from "./helpers";
import type { RaiseOrderTotals } from "./raiseOrder";

export const ORDERS_STORAGE_KEY = "MOJARRERIA_TAKU_DELIVERY_ORDERS";
export const ORDERS_STORAGE_VERSION = 3;
export const ORDER_TIME_ZONE = "America/Mexico_City";
export const ORDERS_CHANGED_EVENT = "mojarreria-orders-changed";

export type DeliveryPayment = "efectivo" | "transferencia";
export type DeliveryOrderStatus = "open" | "closed";

export type DeliveryOrder = RaiseOrderTotals & {
  id: string;
  createdAt: string;
  payment: DeliveryPayment;
  latitude?: number | null;
  longitude?: number | null;
  customerPhone?: string | null;
  customerConversationId?: string | null;
  whatsappAccountId?: string | null;
  status?: DeliveryOrderStatus | null;
  dailyListedAt?: string | null;
  dayKey?: string | null;
  assignedDriver?: {
    phone: string;
    name: string | null;
    assignedAt: string;
  } | null;
};

type OrdersPayload = {
  version: number;
  items: DeliveryOrder[];
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function todayOrderKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ORDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function readPayload(): OrdersPayload {
  if (!canUseStorage()) return { version: ORDERS_STORAGE_VERSION, items: [] };
  try {
    const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return { version: ORDERS_STORAGE_VERSION, items: [] };
    const parsed = JSON.parse(raw) as Partial<OrdersPayload>;
    if (!Array.isArray(parsed.items)) {
      return { version: ORDERS_STORAGE_VERSION, items: [] };
    }
    return {
      version: ORDERS_STORAGE_VERSION,
      items: parsed.items,
    };
  } catch {
    return { version: ORDERS_STORAGE_VERSION, items: [] };
  }
}

function writePayload(items: DeliveryOrder[]) {
  if (!canUseStorage()) return;
  const payload: OrdersPayload = {
    version: ORDERS_STORAGE_VERSION,
    items,
  };
  window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
}

export function listDeliveryOrders() {
  return readPayload().items;
}

export function listTodayOrders(now = new Date()) {
  const dayKey = todayOrderKey(now);
  return listDeliveryOrders().filter(
    (item) => item.dailyListedAt && item.dayKey === dayKey,
  );
}

export function latestUnassignedOrder() {
  return listDeliveryOrders().find((item) => !item.assignedDriver) ?? null;
}

export function savePendingOrder(input: {
  totals: RaiseOrderTotals;
  payment: DeliveryPayment;
  latitude?: number | null;
  longitude?: number | null;
  customerPhone?: string | null;
  customerConversationId?: string | null;
  whatsappAccountId?: string | null;
}) {
  const order: DeliveryOrder = {
    ...input.totals,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `order:${Date.now()}`,
    createdAt: new Date().toISOString(),
    payment: input.payment,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    customerPhone: digitsPhone(input.customerPhone ?? "") || null,
    customerConversationId: input.customerConversationId ?? null,
    whatsappAccountId: input.whatsappAccountId ?? null,
    status: "open",
    dailyListedAt: null,
    dayKey: null,
    assignedDriver: null,
  };
  writePayload([order, ...listDeliveryOrders()]);
  return order;
}

function replaceOrder(order: DeliveryOrder) {
  writePayload(
    listDeliveryOrders().map((item) => (item.id === order.id ? order : item)),
  );
  return order;
}

export function assignLatestOrder(driver: {
  phone: string;
  name?: string | null;
}) {
  const items = listDeliveryOrders();
  const index = items.findIndex((item) => !item.assignedDriver);
  if (index < 0) return null;
  const assigned: DeliveryOrder = {
    ...items[index],
    assignedDriver: {
      phone: driver.phone,
      name: driver.name?.trim() || null,
      assignedAt: new Date().toISOString(),
    },
  };
  const next = [...items];
  next[index] = assigned;
  writePayload(next);
  return assigned;
}

export function orderStatus(order: DeliveryOrder): DeliveryOrderStatus {
  return order.status === "closed" ? "closed" : "open";
}

export function listOrdersByStatus() {
  return [...listDeliveryOrders()].sort((left, right) => {
    const status =
      Number(orderStatus(left) === "closed") -
      Number(orderStatus(right) === "closed");
    if (status !== 0) return status;
    const leftStamp =
      left.dailyListedAt ?? left.assignedDriver?.assignedAt ?? left.createdAt;
    const rightStamp =
      right.dailyListedAt ??
      right.assignedDriver?.assignedAt ??
      right.createdAt;
    return rightStamp.localeCompare(leftStamp);
  });
}

export function closeDeliveryOrder(orderId: string) {
  const current = listDeliveryOrders().find((item) => item.id === orderId);
  if (!current) return null;
  return replaceOrder({
    ...current,
    status: "closed",
  });
}

export function addOrderToToday(orderId: string, now = new Date()) {
  const current = listDeliveryOrders().find((item) => item.id === orderId);
  if (!current) return null;
  return replaceOrder({
    ...current,
    dailyListedAt: now.toISOString(),
    dayKey: todayOrderKey(now),
  });
}
