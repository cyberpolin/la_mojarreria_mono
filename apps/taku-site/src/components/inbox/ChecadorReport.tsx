"use client";

import { useMemo, useState } from "react";
import {
  buildAttendanceWeeks,
  formatWorkedHours,
  type AttendancePunchRecord,
  type EmployeeDayAttendance,
} from "./attendance";
import { formatDayLabel } from "./dayClose";
import { formatTime } from "./helpers";
import { formatMxn } from "./raiseOrder";
import { currentWeekStart, formatWeekRange } from "./weeklyReport";

function Chevron({ open }: { open: boolean }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center text-slate-500">
      {open ? "▾" : "▸"}
    </span>
  );
}

function dayStatus(day: EmployeeDayAttendance) {
  if (day.late && day.entrada && day.salida) {
    return `Retardo · ${formatWorkedHours(day.minutes)}`;
  }
  if (day.late) return "Retardo";
  if (day.entrada && day.salida) return formatWorkedHours(day.minutes);
  if (day.entrada) return "Sin salida";
  if (day.salida) return "Sin entrada";
  return "Falta";
}

export function ChecadorReport({
  punches,
  loading,
}: {
  punches: AttendancePunchRecord[];
  loading: boolean;
}) {
  const weeks = useMemo(() => buildAttendanceWeeks(punches), [punches]);
  const thisWeek = currentWeekStart();
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(
    () => new Set([thisWeek]),
  );

  function toggleWeek(weekStart: string) {
    setOpenWeeks((current) => {
      const next = new Set(current);
      if (next.has(weekStart)) next.delete(weekStart);
      else next.add(weekStart);
      return next;
    });
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando reporte...</p>;
  }

  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Reporte semanal
      </p>
      {weeks.map((week) => {
        const open = openWeeks.has(week.weekStart);
        const weekPay = week.employees.reduce(
          (sum, item) => sum + (item.pay || 0),
          0,
        );
        return (
          <section
            key={week.weekStart}
            className="overflow-hidden rounded-xl border border-slate-200"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleWeek(week.weekStart)}
              className="flex min-h-11 w-full items-center gap-2 px-3 py-3 text-left hover:bg-slate-50"
            >
              <Chevron open={open} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold capitalize text-slate-950">
                  {formatWeekRange(week.weekStart, week.weekEnd)}
                  {week.weekStart === thisWeek ? " · Esta semana" : ""}
                </p>
              </div>
            </button>
            <div className="border-t border-slate-200 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                A pagar
              </p>
              <ul className="mt-2 grid gap-2">
                {week.employees.map((employee) => (
                  <li
                    key={`${week.weekStart}-${employee.employeeId}-pay`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <p className="min-w-0 truncate text-sm text-slate-800">
                      {employee.employeeName}
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-950">
                      {formatMxn(employee.pay || 0)}
                    </p>
                  </li>
                ))}
                <li className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-2">
                  <p className="text-sm font-semibold text-slate-950">Total</p>
                  <p className="text-sm font-semibold tabular-nums text-slate-950">
                    {formatMxn(weekPay)}
                  </p>
                </li>
              </ul>
            </div>
            {open
              ? week.employees.map((employee) => (
                  <div
                    key={employee.employeeId}
                    className="border-t border-slate-200 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">
                          {employee.employeeName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {formatMxn(employee.dailyRate)} / dia ·{" "}
                          {employee.workedDays}{" "}
                          {employee.workedDays === 1 ? "dia" : "dias"} ·{" "}
                          {employee.lateDays}{" "}
                          {employee.lateDays === 1 ? "retardo" : "retardos"}
                          {employee.totalMinutes > 0
                            ? ` · ${formatWorkedHours(employee.totalMinutes)}`
                            : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-950">
                        {formatMxn(employee.pay || 0)}
                      </p>
                    </div>
                    <ul className="mt-2 divide-y divide-slate-100">
                      {employee.days.map((day) => (
                        <li
                          key={day.dayKey}
                          className="flex items-start justify-between gap-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium capitalize text-slate-800">
                              {formatDayLabel(day.dayKey)}
                            </p>
                            <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                              Ent {formatTime(day.entrada?.createdAt) || "—"}
                              {day.late ? " retardo" : ""}
                              {" · "}
                              Sal {formatTime(day.salida?.createdAt) || "—"}
                            </p>
                          </div>
                          <p className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-700">
                            {dayStatus(day)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              : null}
          </section>
        );
      })}
    </div>
  );
}
