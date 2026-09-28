import {
  ORDER_TIME_ZONE,
  todayOrderKey,
  type DeliveryOrder,
} from "./pendingOrders";
import { formatMxn } from "./raiseOrder";
import { orderWeekDayKey } from "./weeklyReport";

export const DAILY_CASH_CLOSE_OPEN_EVENT = "mojarreria-daily-cash-close-open";
export const CASH_CLOSE_HOUR = 17;

export type DayOrderGroup = {
  dayKey: string;
  orders: DeliveryOrder[];
};

export function mexicoHour(now = new Date()) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: ORDER_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  const hour = Number(label);
  return Number.isFinite(hour) ? hour : now.getHours();
}

export function canCloseDay(dayKey: string, now = new Date()) {
  const today = todayOrderKey(now);
  if (dayKey < today) return true;
  if (dayKey > today) return false;
  return mexicoHour(now) >= CASH_CLOSE_HOUR;
}

export function groupOrdersByDay(orders: DeliveryOrder[]): DayOrderGroup[] {
  const groups = new Map<string, DeliveryOrder[]>();
  for (const order of orders) {
    const dayKey = orderWeekDayKey(order);
    const list = groups.get(dayKey) ?? [];
    list.push(order);
    groups.set(dayKey, list);
  }
  return [...groups.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([dayKey, items]) => ({ dayKey, orders: items }));
}

export function withToday(
  groups: DayOrderGroup[],
  now = new Date(),
): DayOrderGroup[] {
  const today = todayOrderKey(now);
  if (groups.some((group) => group.dayKey === today)) return groups;
  return [{ dayKey: today, orders: [] }, ...groups];
}

export function formatDayLabel(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00`);
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function cashCloseDiferencia(input: {
  expectedTotal: number;
  countedEfectivo: number;
  countedBanco: number;
  extraGastos: number;
}) {
  return (
    Math.round(
      (input.countedEfectivo +
        input.countedBanco -
        (input.expectedTotal - input.extraGastos)) *
        100,
    ) / 100
  );
}

export function formatCashDifference(value: number) {
  if (value === 0) return "Cuadra";
  if (value > 0) return `Sobra ${formatMxn(value)}`;
  return `Falta ${formatMxn(Math.abs(value))}`;
}

export function daySales(orders: DeliveryOrder[]) {
  const efectivo = orders
    .filter((order) => order.payment === "efectivo")
    .reduce((sum, order) => sum + order.total, 0);
  const transferencia = orders
    .filter((order) => order.payment === "transferencia")
    .reduce((sum, order) => sum + order.total, 0);
  return {
    efectivo,
    transferencia,
    total: efectivo + transferencia,
    orderCount: orders.length,
    mojarras: orders.reduce((sum, order) => sum + order.mojarras, 0),
    empanadas: orders.reduce((sum, order) => sum + order.empanadas, 0),
  };
}

export function openDailyCashClose(dayKey: string) {
  if (typeof window === "undefined") return;
  if (!canCloseDay(dayKey)) return;
  window.dispatchEvent(
    new CustomEvent(DAILY_CASH_CLOSE_OPEN_EVENT, {
      detail: { dayKey },
    }),
  );
}
