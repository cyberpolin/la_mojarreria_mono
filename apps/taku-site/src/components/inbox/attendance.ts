"use client";

import { TakuApiError } from "@/lib/taku-api";
import { punchAttendance, type AttendancePunchRecord } from "./api";
import { todayOrderKey } from "./pendingOrders";
import { findEmployee, type TimeClockEmployee } from "./timeClockEmployees";
import type { InboxWhatsAppAccount } from "./types";

export type { AttendancePunchRecord };
export const ATTENDANCE_KEY = "MOJARRERIA_TAKU_ATTENDANCE";
export const ATTENDANCE_VERSION = 2;
export const CHECADOR_OPEN_EVENT = "mojarreria-checador-open";
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

function readPunches(): AttendancePunchRecord[] {
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
}

export function isTimeClockEnabled(
  account: InboxWhatsAppAccount | null | undefined,
) {
  return Boolean(account?.timeClockEnabled);
}

export function nextPunchType(
  punches: AttendancePunchRecord[],
  employeeId: string,
  accountId?: string,
): AttendancePunchType {
  const last = [...punches]
    .filter((punch) => punch.employeeId === employeeId)
    .filter((punch) =>
      accountId ? punch.whatsappAccountId === accountId : true,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  return last?.type === "entrada" ? "salida" : "entrada";
}

export function rememberPunch(punch: AttendancePunchRecord) {
  const items = readPunches().filter((item) => item.id !== punch.id);
  writePunches([punch, ...items]);
}

export function localPunch(
  employee: TimeClockEmployee,
  accountId: string,
): AttendancePunchRecord {
  const type = nextPunchType(readPunches(), employee.id, accountId);
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

export async function clockEmployee(
  phone: string,
  pin: string,
  account: InboxWhatsAppAccount,
) {
  if (!isTimeClockEnabled(account)) {
    throw new Error("El checador no esta activo para este numero.");
  }
  const employee = findEmployee(phone, pin);
  if (!employee) {
    throw new Error("Numero o PIN incorrecto.");
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
      (error.code === "INVALID_TIME_CLOCK" ||
        error.code === "TIME_CLOCK_DISABLED")
    ) {
      throw new Error(clockErrorMessage(error));
    }
    const punch = localPunch(employee, account.id);
    rememberPunch(punch);
    return punch;
  }
}
