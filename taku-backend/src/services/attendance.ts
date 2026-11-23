import { todayDateKey } from "./weekClose.js";

export type TimeClockEmployee = {
  id: string;
  name: string;
  phone: string;
  pin: string;
};

export const TIME_CLOCK_EMPLOYEES: TimeClockEmployee[] = [
  {
    id: "emp_lucy",
    name: "Lucy Cruz",
    phone: "9932080328",
    pin: "1323",
  },
  {
    id: "emp_america",
    name: "America",
    phone: "9932357200",
    pin: "3454",
  },
];

export function lastPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.slice(-10);
}

export function findEmployee(phone: string, pin: string) {
  const phoneDigits = lastPhoneDigits(phone);
  const pinValue = pin.trim();
  if (phoneDigits.length < 10 || !pinValue) return null;
  return (
    TIME_CLOCK_EMPLOYEES.find(
      (employee) =>
        lastPhoneDigits(employee.phone) === phoneDigits &&
        employee.pin === pinValue,
    ) ?? null
  );
}

export const TIME_CLOCK_ZONE = "America/Mexico_City";
export const ENTRADA_AFTER_MINUTES = 8 * 60 + 59;
export const SALIDA_AFTER_MINUTES = 17 * 60 + 30;

export type AttendancePunchType = "entrada" | "salida";

export type PunchDecision =
  | { ok: true; type: AttendancePunchType }
  | { ok: false; code: string; message: string };

export function punchDayKey(now = new Date(), timeZone = TIME_CLOCK_ZONE) {
  return todayDateKey(now, timeZone);
}

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
  }>;
  employeeId: string;
  dayKey: string;
  now?: Date;
  timeZone?: string;
}): PunchDecision {
  const today = input.punches.filter(
    (punch) =>
      punch.employeeId === input.employeeId && punch.dayKey === input.dayKey,
  );
  const hasEntrada = today.some((punch) => punch.type === "entrada");
  const hasSalida = today.some((punch) => punch.type === "salida");
  const minutes = clockMinutesInZone(
    input.now ?? new Date(),
    input.timeZone ?? TIME_CLOCK_ZONE,
  );

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
