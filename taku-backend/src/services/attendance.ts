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

export function nextPunchType(
  punches: Array<{
    employeeId: string;
    type: "entrada" | "salida";
    createdAt: string;
  }>,
  employeeId: string,
): "entrada" | "salida" {
  const last = [...punches]
    .filter((punch) => punch.employeeId === employeeId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  return last?.type === "entrada" ? "salida" : "entrada";
}

export function punchDayKey(
  now = new Date(),
  timeZone = "America/Mexico_City",
) {
  return todayDateKey(now, timeZone);
}
