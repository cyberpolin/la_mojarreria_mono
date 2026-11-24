import { digitsPhone } from "./helpers";
import type { RaiseOrderTotals } from "./raiseOrder";

export const ORDERS_STORAGE_KEY = "MOJARRERIA_TAKU_DELIVERY_ORDERS";
export const ORDERS_STORAGE_VERSION = 3;
export const ORDER_TIME_ZONE = "America/Mexico_City";
export const ORDERS_CHANGED_EVENT = "mojarreria-orders-changed";

export type DeliveryPayment = "efectivo" | "transferencia";
export type DeliveryOrderStatus = "open" | "closed";
export type DeliveryOrderClose = "user" | "system";

export const SYSTEM_CLOSE_HOUR = 18;

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
  closedBy?: DeliveryOrderClose | null;
  closedAt?: string | null;
  dailyListedAt?: string | null;
  dayKey?: string | null;
  assignedDriver?: {
    phone: string;
    name: string | null;
    assignedAt: string;
  } | null;
  ownerAlertStepsSent?: number[] | null;
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

export function orderCloseLabel(order: DeliveryOrder) {
  if (orderStatus(order) !== "closed") return "Abierto";
  return order.closedBy === "system" ? "Cerrado por sistema" : "Cerrado";
}

function zonedClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  let hour = Number(read("hour"));
  if (!Number.isFinite(hour) || hour === 24) hour = 0;
  return {
    dayKey: `${read("year")}-${read("month")}-${read("day")}`,
    hour,
  };
}

function addDayKey(dayKey: string, amount: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + amount),
  );
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSystemCloseDue(order: DeliveryOrder, now = new Date()) {
  if (orderStatus(order) !== "open") return false;
  const createdAt = new Date(order.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  const created = zonedClock(createdAt);
  const deadlineDay =
    created.hour >= SYSTEM_CLOSE_HOUR
      ? addDayKey(created.dayKey, 1)
      : created.dayKey;
  if (!deadlineDay) return false;
  const current = zonedClock(now);
  if (current.dayKey > deadlineDay) return true;
  if (current.dayKey < deadlineDay) return false;
  return current.hour >= SYSTEM_CLOSE_HOUR;
}

export function activeOrderCustomerKeys(orders: DeliveryOrder[]) {
  const keys = new Set<string>();
  for (const order of orders) {
    if (orderStatus(order) !== "open") continue;
    const key = digitsPhone(order.customerPhone ?? "").slice(-10);
    if (key.length === 10) keys.add(key);
  }
  return keys;
}

export function phoneHasActiveOrder(
  phone: string | null | undefined,
  keys: Set<string>,
) {
  const key = digitsPhone(phone ?? "").slice(-10);
  return key.length === 10 && keys.has(key);
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

export function closeDeliveryOrder(orderId: string, now = new Date()) {
  const current = listDeliveryOrders().find((item) => item.id === orderId);
  if (!current || orderStatus(current) === "closed") return current ?? null;
  return replaceOrder({
    ...current,
    status: "closed",
    closedBy: "user",
    closedAt: now.toISOString(),
  });
}

export function closeDueOrders(now = new Date()) {
  const items = listDeliveryOrders();
  let changed = false;
  const next = items.map((item) => {
    if (!isSystemCloseDue(item, now)) return item;
    changed = true;
    return {
      ...item,
      status: "closed" as const,
      closedBy: "system" as const,
      closedAt: now.toISOString(),
    };
  });
  if (changed) writePayload(next);
  return changed;
}

export function orderNumber(phone?: string | null) {
  const digits = digitsPhone(phone ?? "");
  if (digits.length < 4) return digits || null;
  return digits.slice(-4);
}

export function recordOwnerAlertSteps(orderId: string, steps: number[]) {
  const current = listDeliveryOrders().find((item) => item.id === orderId);
  if (!current || steps.length === 0) return current ?? null;
  const sent = new Set(current.ownerAlertStepsSent ?? []);
  let changed = false;
  for (const step of steps) {
    if (!sent.has(step)) {
      sent.add(step);
      changed = true;
    }
  }
  if (!changed) return current;
  return replaceOrder({
    ...current,
    ownerAlertStepsSent: [...sent].sort((left, right) => left - right),
  });
}

export function clearOwnerAlertSteps(orderId: string, steps: number[]) {
  const current = listDeliveryOrders().find((item) => item.id === orderId);
  if (!current || steps.length === 0) return current ?? null;
  const remove = new Set(steps);
  const next = (current.ownerAlertStepsSent ?? []).filter(
    (step) => !remove.has(step),
  );
  return replaceOrder({
    ...current,
    ownerAlertStepsSent: next,
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
