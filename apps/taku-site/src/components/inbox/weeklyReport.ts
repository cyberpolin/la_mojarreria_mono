import {
  ORDER_TIME_ZONE,
  listDeliveryOrders,
  orderNumber,
  todayOrderKey,
  type DeliveryOrder,
} from "./pendingOrders";

export const WEEKLY_REPORTS_KEY = "MOJARRERIA_TAKU_WEEKLY_REPORTS";
export const WEEKLY_REPORTS_VERSION = 1;
export const WEEKLY_REPORT_OPEN_EVENT = "mojarreria-weekly-report-open";

export type WeeklyReportOrder = {
  id: string;
  dayKey: string;
  number: string | null;
  customerPhone: string | null;
  driver: string;
  payment: DeliveryOrder["payment"];
  mojarras: number;
  empanadas: number;
  delivery: number;
  total: number;
};

export type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  generatedOn: string;
  orderCount: number;
  mojarras: number;
  empanadas: number;
  delivery: number;
  efectivo: number;
  transferencia: number;
  total: number;
  orders: WeeklyReportOrder[];
};

type ReportsPayload = {
  version: number;
  items: WeeklyReport[];
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function mexicoWeekday(now = new Date()) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: ORDER_TIME_ZONE,
    weekday: "short",
  }).format(now);
  return WEEKDAY_INDEX[label] ?? now.getDay();
}

export function addDayKey(dayKey: string, amount: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function mondayOfWeek(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDayKey(dayKey, offset);
}

export function orderWeekDayKey(order: DeliveryOrder) {
  if (order.dayKey) return order.dayKey;
  const stamp =
    order.dailyListedAt ?? order.assignedDriver?.assignedAt ?? order.createdAt;
  return todayOrderKey(new Date(stamp));
}

function readPayload(): ReportsPayload {
  if (!canUseStorage()) return { version: WEEKLY_REPORTS_VERSION, items: [] };
  try {
    const raw = window.localStorage.getItem(WEEKLY_REPORTS_KEY);
    if (!raw) return { version: WEEKLY_REPORTS_VERSION, items: [] };
    const parsed = JSON.parse(raw) as Partial<ReportsPayload>;
    if (!Array.isArray(parsed.items)) {
      return { version: WEEKLY_REPORTS_VERSION, items: [] };
    }
    return { version: WEEKLY_REPORTS_VERSION, items: parsed.items };
  } catch {
    return { version: WEEKLY_REPORTS_VERSION, items: [] };
  }
}

function writePayload(items: WeeklyReport[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    WEEKLY_REPORTS_KEY,
    JSON.stringify({ version: WEEKLY_REPORTS_VERSION, items }),
  );
}

export function listWeeklyReports() {
  return [...readPayload().items].sort((left, right) =>
    right.weekStart.localeCompare(left.weekStart),
  );
}

export function readWeeklyReport(weekStart: string) {
  return (
    readPayload().items.find((item) => item.weekStart === weekStart) ?? null
  );
}

export function targetWeeklyReportStart(now = new Date()) {
  const today = todayOrderKey(now);
  const weekday = mexicoWeekday(now);
  if (weekday === 0) return mondayOfWeek(today);
  if (weekday === 1) {
    const lastMonday = addDayKey(today, -7);
    if (!readWeeklyReport(lastMonday)) return lastMonday;
  }
  return null;
}

export function buildWeeklyReport(weekStart: string, now = new Date()) {
  const weekEnd = addDayKey(weekStart, 6);
  const orders = listDeliveryOrders()
    .filter((order) => {
      const dayKey = orderWeekDayKey(order);
      return dayKey >= weekStart && dayKey <= weekEnd;
    })
    .sort((left, right) =>
      orderWeekDayKey(left).localeCompare(orderWeekDayKey(right)),
    );

  const snapshot: WeeklyReportOrder[] = orders.map((order) => ({
    id: order.id,
    dayKey: orderWeekDayKey(order),
    number: orderNumber(order.customerPhone),
    customerPhone: order.customerPhone ?? null,
    driver:
      order.assignedDriver?.name ||
      order.assignedDriver?.phone ||
      "Sin asignar",
    payment: order.payment,
    mojarras: order.mojarras,
    empanadas: order.empanadas,
    delivery: order.delivery,
    total: order.total,
  }));

  return {
    weekStart,
    weekEnd,
    generatedAt: now.toISOString(),
    generatedOn: todayOrderKey(now),
    orderCount: snapshot.length,
    mojarras: snapshot.reduce((sum, order) => sum + order.mojarras, 0),
    empanadas: snapshot.reduce((sum, order) => sum + order.empanadas, 0),
    delivery: snapshot.reduce((sum, order) => sum + order.delivery, 0),
    efectivo: snapshot
      .filter((order) => order.payment === "efectivo")
      .reduce((sum, order) => sum + order.total, 0),
    transferencia: snapshot
      .filter((order) => order.payment === "transferencia")
      .reduce((sum, order) => sum + order.total, 0),
    total: snapshot.reduce((sum, order) => sum + order.total, 0),
    orders: snapshot,
  } satisfies WeeklyReport;
}

function saveWeeklyReport(report: WeeklyReport) {
  const items = readPayload().items.filter(
    (item) => item.weekStart !== report.weekStart,
  );
  writePayload([report, ...items]);
  return report;
}

export function ensureWeeklyReport(now = new Date()) {
  const target = targetWeeklyReportStart(now);
  let justGenerated = false;
  if (target && !readWeeklyReport(target)) {
    saveWeeklyReport(buildWeeklyReport(target, now));
    justGenerated = true;
  }
  const latest = listWeeklyReports()[0] ?? null;
  const currentWeek = mondayOfWeek(todayOrderKey(now));
  const report =
    (target ? readWeeklyReport(target) : null) ??
    latest ??
    buildWeeklyReport(currentWeek, now);
  return {
    report,
    justGenerated,
    saved: Boolean(readWeeklyReport(report.weekStart)),
  };
}

export type WeekOrderGroup = {
  weekStart: string;
  weekEnd: string;
  orders: DeliveryOrder[];
};

export function currentWeekStart(now = new Date()) {
  return mondayOfWeek(todayOrderKey(now));
}

export function groupOrdersByWeek(orders: DeliveryOrder[]): WeekOrderGroup[] {
  const groups = new Map<string, DeliveryOrder[]>();
  for (const order of orders) {
    const weekStart = mondayOfWeek(orderWeekDayKey(order));
    const list = groups.get(weekStart) ?? [];
    list.push(order);
    groups.set(weekStart, list);
  }
  return [...groups.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([weekStart, items]) => ({
      weekStart,
      weekEnd: addDayKey(weekStart, 6),
      orders: items,
    }));
}

export function withCurrentWeek(
  groups: WeekOrderGroup[],
  now = new Date(),
): WeekOrderGroup[] {
  const weekStart = currentWeekStart(now);
  if (groups.some((group) => group.weekStart === weekStart)) return groups;
  return [
    { weekStart, weekEnd: addDayKey(weekStart, 6), orders: [] },
    ...groups,
  ];
}

export function isPastWeek(weekEnd: string, now = new Date()) {
  return todayOrderKey(now) > weekEnd;
}

export function lastPastWeekStart(now = new Date()) {
  return addDayKey(currentWeekStart(now), -7);
}

export function canCloseWeek(weekStart: string, now = new Date()) {
  return isPastWeek(addDayKey(weekStart, 6), now);
}

export function openWeeklyReport(weekStart?: string) {
  if (typeof window === "undefined") return;
  const start = weekStart ?? lastPastWeekStart();
  if (!canCloseWeek(start)) return;
  window.dispatchEvent(
    new CustomEvent(WEEKLY_REPORT_OPEN_EVENT, {
      detail: { weekStart: start },
    }),
  );
}

export function formatWeekRange(weekStart: string, weekEnd: string) {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${weekEnd}T12:00:00`);
  const day = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
  });
  const year = new Intl.DateTimeFormat("es-MX", { year: "numeric" });
  return `${day.format(start)} - ${day.format(end)} ${year.format(end)}`;
}
