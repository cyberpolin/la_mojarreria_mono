"use client";

import { TakuApiError } from "@/lib/taku-api";
import { punchAttendance, type AttendancePunchRecord } from "./api";
import { todayOrderKey } from "./pendingOrders";
import {
  TIME_CLOCK_EMPLOYEES,
  findEmployee,
  type TimeClockEmployee,
} from "./timeClockEmployees";
import type { InboxWhatsAppAccount } from "./types";
import { addDayKey, currentWeekStart, mondayOfWeek } from "./weeklyReport";

export type { AttendancePunchRecord };
export const ATTENDANCE_KEY = "MOJARRERIA_TAKU_ATTENDANCE";
export const ATTENDANCE_VERSION = 2;
export const CHECADOR_OPEN_EVENT = "mojarreria-checador-open";
export const ATTENDANCE_CHANGED_EVENT = "mojarreria-attendance-changed";
export const WHATSAPP_ACCOUNTS_CHANGED_EVENT =
  "mojarreria-whatsapp-accounts-changed";

export type AttendancePunchType = "entrada" | "salida";

type AttendancePayload = {
  version: number;
  items: AttendancePunchRecord[];
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function readPunches(): AttendancePunchRecord[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(ATTENDANCE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<AttendancePayload>;
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function writePunches(items: AttendancePunchRecord[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    ATTENDANCE_KEY,
    JSON.stringify({ version: ATTENDANCE_VERSION, items }),
  );
  window.dispatchEvent(new Event(ATTENDANCE_CHANGED_EVENT));
}

export function isTimeClockEnabled(
  account: InboxWhatsAppAccount | null | undefined,
) {
  return Boolean(account?.timeClockEnabled);
}

export const TIME_CLOCK_ZONE = "America/Mexico_City";
export const ENTRADA_AFTER_MINUTES = 8 * 60 + 59;
export const SALIDA_AFTER_MINUTES = 17 * 60 + 30;
export const AGENT_ENTRADA_REMINDER_MINUTES = 9 * 60;
export const AGENT_SALIDA_REMINDER_MINUTES = 17 * 60;

export type PunchDecision =
  | { ok: true; type: AttendancePunchType }
  | { ok: false; code: string; message: string };

export function clockMinutesInZone(
  now = new Date(),
  timeZone = TIME_CLOCK_ZONE,
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return now.getHours() * 60 + now.getMinutes();
  }
  return hour * 60 + minute;
}

export function evaluateDayPunch(input: {
  punches: Array<{
    employeeId: string;
    type: AttendancePunchType;
    dayKey: string;
    whatsappAccountId?: string;
  }>;
  employeeId: string;
  dayKey: string;
  accountId?: string;
  now?: Date;
}): PunchDecision {
  const today = input.punches.filter(
    (punch) =>
      punch.employeeId === input.employeeId &&
      punch.dayKey === input.dayKey &&
      (input.accountId ? punch.whatsappAccountId === input.accountId : true),
  );
  const hasEntrada = today.some((punch) => punch.type === "entrada");
  const hasSalida = today.some((punch) => punch.type === "salida");
  const minutes = clockMinutesInZone(input.now ?? new Date());

  if (hasEntrada && hasSalida) {
    return {
      ok: false,
      code: "TIME_CLOCK_COMPLETE",
      message: "Ya registraste entrada y salida hoy.",
    };
  }

  if (!hasEntrada) {
    if (minutes < ENTRADA_AFTER_MINUTES) {
      return {
        ok: false,
        code: "TIME_CLOCK_TOO_EARLY",
        message: "La entrada solo se puede marcar despues de las 8:59 a.m.",
      };
    }
    return { ok: true, type: "entrada" };
  }

  if (minutes < SALIDA_AFTER_MINUTES) {
    return {
      ok: false,
      code: "TIME_CLOCK_TOO_EARLY",
      message: "La salida solo se puede marcar despues de las 5:30 p.m.",
    };
  }
  return { ok: true, type: "salida" };
}

export function employeeHasDayPunch(
  punches: Array<{
    employeeId: string;
    type: AttendancePunchType;
    dayKey: string;
    whatsappAccountId?: string;
  }>,
  employeeId: string,
  dayKey: string,
  type: AttendancePunchType,
  accountId?: string,
) {
  return punches.some(
    (punch) =>
      punch.employeeId === employeeId &&
      punch.dayKey === dayKey &&
      punch.type === type &&
      (accountId ? punch.whatsappAccountId === accountId : true),
  );
}

export function missingTeamPunch(
  punches: Array<{
    employeeId: string;
    type: AttendancePunchType;
    dayKey: string;
    whatsappAccountId?: string;
  }>,
  dayKey: string,
  type: AttendancePunchType,
  accountId?: string,
) {
  return TIME_CLOCK_EMPLOYEES.some(
    (employee) =>
      !employeeHasDayPunch(punches, employee.id, dayKey, type, accountId),
  );
}

export function agentClockFabAction(input: {
  punches: Array<{
    employeeId: string;
    type: AttendancePunchType;
    dayKey: string;
    whatsappAccountId?: string;
  }>;
  dayKey: string;
  accountId?: string;
  now?: Date;
}): AttendancePunchType | null {
  const minutes = clockMinutesInZone(input.now);
  const missingEntrada = missingTeamPunch(
    input.punches,
    input.dayKey,
    "entrada",
    input.accountId,
  );
  const missingSalida = missingTeamPunch(
    input.punches,
    input.dayKey,
    "salida",
    input.accountId,
  );

  if (minutes >= AGENT_SALIDA_REMINDER_MINUTES) {
    if (missingEntrada) return "entrada";
    if (missingSalida) return "salida";
    return null;
  }
  if (minutes >= AGENT_ENTRADA_REMINDER_MINUTES && missingEntrada) {
    return "entrada";
  }
  return null;
}

export function rememberPunch(punch: AttendancePunchRecord) {
  const items = readPunches().filter((item) => item.id !== punch.id);
  writePunches([punch, ...items]);
}

export function localPunch(
  employee: TimeClockEmployee,
  accountId: string,
  type: AttendancePunchType,
): AttendancePunchRecord {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `punch:${Date.now()}`,
    whatsappAccountId: accountId,
    employeeId: employee.id,
    employeeName: employee.name,
    phoneNumber: employee.phone,
    type,
    dayKey: todayOrderKey(),
    createdAt: new Date().toISOString(),
  };
}

export function openChecador(account: InboxWhatsAppAccount) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHECADOR_OPEN_EVENT, { detail: { account } }),
  );
}

export function notifyWhatsAppAccountsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WHATSAPP_ACCOUNTS_CHANGED_EVENT));
}

const BLOCKED_CLOCK_CODES = new Set([
  "INVALID_TIME_CLOCK",
  "TIME_CLOCK_DISABLED",
  "TIME_CLOCK_COMPLETE",
  "TIME_CLOCK_TOO_EARLY",
  "TIME_CLOCK_NO_ENTRADA",
]);

export function clockErrorMessage(error: unknown) {
  if (error instanceof TakuApiError) {
    if (error.code === "INVALID_TIME_CLOCK") {
      return "Numero o PIN incorrecto.";
    }
    if (error.code === "TIME_CLOCK_DISABLED") {
      return "El checador no esta activo para este numero.";
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "No se pudo marcar. Intenta de nuevo.";
}

function mergePunches(
  known: AttendancePunchRecord[] | undefined,
  accountId: string,
) {
  const items = [...(known ?? []), ...readPunches()].filter(
    (punch) => punch.whatsappAccountId === accountId,
  );
  const seen = new Set<string>();
  return items.filter((punch) => {
    if (seen.has(punch.id)) return false;
    seen.add(punch.id);
    return true;
  });
}

export async function clockEmployee(
  phone: string,
  pin: string,
  account: InboxWhatsAppAccount,
  knownPunches?: AttendancePunchRecord[],
) {
  if (!isTimeClockEnabled(account)) {
    throw new Error("El checador no esta activo para este numero.");
  }
  const employee = findEmployee(phone, pin);
  if (!employee) {
    throw new Error("Numero o PIN incorrecto.");
  }
  const decision = evaluateDayPunch({
    punches: mergePunches(knownPunches, account.id),
    employeeId: employee.id,
    dayKey: todayOrderKey(),
    accountId: account.id,
  });
  if (!decision.ok) {
    throw new Error(decision.message);
  }
  try {
    const punch = await punchAttendance({
      whatsappAccountId: account.id,
      phoneNumber: employee.phone,
      pin: employee.pin,
    });
    rememberPunch(punch);
    return punch;
  } catch (error) {
    if (
      error instanceof TakuApiError &&
      error.code &&
      BLOCKED_CLOCK_CODES.has(error.code)
    ) {
      throw new Error(clockErrorMessage(error));
    }
    const punch = localPunch(employee, account.id, decision.type);
    rememberPunch(punch);
    return punch;
  }
}

export type EmployeeDayAttendance = {
  dayKey: string;
  entrada: AttendancePunchRecord | null;
  salida: AttendancePunchRecord | null;
  minutes: number | null;
};

export type EmployeeWeekAttendance = {
  employeeId: string;
  employeeName: string;
  days: EmployeeDayAttendance[];
  completeDays: number;
  totalMinutes: number;
};

export type AttendanceWeekGroup = {
  weekStart: string;
  weekEnd: string;
  employees: EmployeeWeekAttendance[];
};

function punchOfType(
  punches: AttendancePunchRecord[],
  employeeId: string,
  dayKey: string,
  type: AttendancePunchType,
) {
  return (
    punches.find(
      (punch) =>
        punch.employeeId === employeeId &&
        punch.dayKey === dayKey &&
        punch.type === type,
    ) ?? null
  );
}

function workedMinutes(
  entrada: AttendancePunchRecord | null,
  salida: AttendancePunchRecord | null,
) {
  if (!entrada || !salida) return null;
  const start = Date.parse(entrada.createdAt);
  const end = Date.parse(salida.createdAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return Math.round((end - start) / 60_000);
}

export function formatWorkedHours(minutes: number | null) {
  if (minutes == null) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest > 0) return `${hours}h ${rest}m`;
  if (hours > 0) return `${hours}h`;
  return `${rest}m`;
}

export function buildAttendanceWeeks(
  punches: AttendancePunchRecord[],
  now = new Date(),
): AttendanceWeekGroup[] {
  const weekStarts = new Set<string>([currentWeekStart(now)]);
  for (const punch of punches) {
    if (punch.dayKey) weekStarts.add(mondayOfWeek(punch.dayKey));
  }
  return [...weekStarts]
    .sort((left, right) => right.localeCompare(left))
    .map((weekStart) => {
      const weekEnd = addDayKey(weekStart, 6);
      const dayKeys = Array.from({ length: 7 }, (_, index) =>
        addDayKey(weekStart, index),
      );
      return {
        weekStart,
        weekEnd,
        employees: TIME_CLOCK_EMPLOYEES.map((employee) => {
          const days = dayKeys.map((dayKey) => {
            const entrada = punchOfType(
              punches,
              employee.id,
              dayKey,
              "entrada",
            );
            const salida = punchOfType(punches, employee.id, dayKey, "salida");
            return {
              dayKey,
              entrada,
              salida,
              minutes: workedMinutes(entrada, salida),
            };
          });
          return {
            employeeId: employee.id,
            employeeName: employee.name,
            days,
            completeDays: days.filter((day) => day.entrada && day.salida)
              .length,
            totalMinutes: days.reduce(
              (sum, day) => sum + (day.minutes ?? 0),
              0,
            ),
          };
        }),
      };
    });
}
