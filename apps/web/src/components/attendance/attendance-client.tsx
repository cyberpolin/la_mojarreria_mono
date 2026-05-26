"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppCard, MetricCard } from "@/components/ui/card";
import {
  AttendanceLogRecord,
  AttendancePayload,
  PendingAttendanceCheckIn,
} from "@/types/attendance";

const CACHE_KEY = "MOJARRERIA_ATTENDANCE_OVERVIEW_CACHE_V1";

const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => todayISO().slice(0, 7);

type AttendancePeriod = "first" | "second";

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthLastDate = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return toDateInput(new Date(year, monthNumber, 0, 12));
};

const getPeriodRange = (month: string, period: AttendancePeriod) => {
  if (period === "first") {
    return { startDate: `${month}-01`, endDate: `${month}-15` };
  }

  return { startDate: `${month}-15`, endDate: getMonthLastDate(month) };
};

const getPendingDate = (startDate: string, endDate: string) => {
  const today = todayISO();
  return today >= startDate && today <= endDate ? today : startDate;
};

const formatTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (minutes: number) => {
  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
};

const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `****${digits.slice(-4)}`;
};

const statusTone = (status: string) => {
  if (status === "OPEN") return "border-slate-600 text-slate-100";
  if (status === "CLOSED") return "border-slate-700 text-slate-300";
  return "border-slate-500 text-slate-100";
};

function PendingList({ pending }: { pending: PendingAttendanceCheckIn[] }) {
  if (pending.length === 0) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
        No pending check-ins for this date.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((employee) => (
        <div
          key={employee.userId}
          className="rounded-lg border border-slate-800 bg-slate-950 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-100">{employee.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                Phone {maskPhone(employee.phone)}
              </p>
            </div>
            <div className="text-right text-sm text-slate-300">
              <p>
                {employee.shiftStart || "--:--"} -{" "}
                {employee.shiftEnd || "--:--"}
              </p>
              <p className="text-xs text-slate-500">
                Break {employee.breakMinutes}m
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LogTable({ logs }: { logs: AttendanceLogRecord[] }) {
  if (logs.length === 0) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
        No attendance records for this date.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-2 py-2 text-left">Date</th>
            <th className="px-2 py-2 text-left">Employee</th>
            <th className="px-2 py-2 text-left">Status</th>
            <th className="px-2 py-2 text-right">In</th>
            <th className="px-2 py-2 text-right">Out</th>
            <th className="px-2 py-2 text-right">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="whitespace-nowrap px-2 py-3 text-slate-400">
                {log.date}
              </td>
              <td className="px-2 py-3 text-slate-100">
                <p className="font-medium">{log.user?.name ?? "Unknown"}</p>
                {log.user?.phone ? (
                  <p className="text-xs text-slate-500">
                    {maskPhone(log.user.phone)}
                  </p>
                ) : null}
              </td>
              <td className="px-2 py-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-xs ${statusTone(
                    log.status,
                  )}`}
                >
                  {log.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right text-slate-300">
                {formatTime(log.clockInAt)}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right text-slate-300">
                {formatTime(log.clockOutAt)}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right text-slate-100">
                {log.status === "CLOSED"
                  ? formatDuration(log.durationMinutes)
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AttendanceClient() {
  const [month, setMonth] = useState(currentMonth);
  const [period, setPeriod] = useState<AttendancePeriod>("first");
  const [deviceId, setDeviceId] = useState("Kiosk001");
  const [payload, setPayload] = useState<AttendancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const loadAttendance = async (
    nextMonth = month,
    nextPeriod = period,
    nextDeviceId = deviceId,
  ) => {
    setLoading(true);
    setError(null);
    const { startDate, endDate } = getPeriodRange(nextMonth, nextPeriod);
    const date = getPendingDate(startDate, endDate);

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const cachedPayload = JSON.parse(cached) as AttendancePayload;
      setPayload(cachedPayload);
      setFromCache(true);
    }

    try {
      const params = new URLSearchParams({
        date,
        startDate,
        endDate,
        deviceId: nextDeviceId,
      });
      const response = await fetch(`/api/attendance?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Attendance request failed (${response.status})`);
      }
      const nextPayload = (await response.json()) as AttendancePayload;
      setPayload(nextPayload);
      localStorage.setItem(CACHE_KEY, JSON.stringify(nextPayload));
      setFromCache(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load attendance",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance(month, period, deviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, period, deviceId]);

  const logs = useMemo(() => payload?.logs ?? [], [payload?.logs]);
  const pending = useMemo(() => payload?.pending ?? [], [payload?.pending]);
  const openLogs = useMemo(
    () => logs.filter((log) => log.status === "OPEN"),
    [logs],
  );
  const closedLogs = useMemo(
    () => logs.filter((log) => log.status === "CLOSED"),
    [logs],
  );
  const totalMinutes = useMemo(
    () => closedLogs.reduce((sum, log) => sum + log.durationMinutes, 0),
    [closedLogs],
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadAttendance(month, period, deviceId);
  };

  const selectedRange = getPeriodRange(month, period);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA ATTENDANCE
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">Attendance</h1>
          <p className="mt-1 text-sm text-slate-400">
            Check-ins and shifts by semi-month period and device.
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Period
            <select
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as AttendancePeriod)
              }
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
            >
              <option value="first">01 to 15</option>
              <option value="second">15 to last day</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Device
            <input
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-lg border border-slate-600 bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </form>
      </header>

      {error ? (
        <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          <p className="font-medium text-slate-100">Attendance issue</p>
          <p>{error}</p>
          {fromCache ? (
            <p className="mt-1 text-slate-300">Showing cached attendance.</p>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Pending" value={String(pending.length)} />
        <MetricCard title="Working" value={String(openLogs.length)} />
        <MetricCard title="Completed" value={String(closedLogs.length)} />
        <MetricCard title="Closed Time" value={formatDuration(totalMinutes)} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <AppCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">
              Pending Check-ins
            </h2>
            <span className="text-xs text-slate-500">
              {payload?.date ??
                getPendingDate(selectedRange.startDate, selectedRange.endDate)}
            </span>
          </div>
          <div className="mt-4">
            <PendingList pending={pending} />
          </div>
        </AppCard>

        <AppCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">
              Attendance Log
            </h2>
            <span className="text-xs text-slate-500">
              {payload?.startDate ?? selectedRange.startDate} to{" "}
              {payload?.endDate ?? selectedRange.endDate}
            </span>
          </div>
          <div className="mt-4">
            <LogTable logs={logs} />
          </div>
        </AppCard>
      </section>
    </main>
  );
}
