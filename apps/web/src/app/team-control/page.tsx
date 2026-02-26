"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/ui/card";
import { TeamControlPayload, TeamRole } from "@/types/team-control";

const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const roleOptions: TeamRole[] = ["COOK", "ASSISTANT", "DELIVERY", "ADMIN"];

export default function TeamControlPage() {
  const [data, setData] = useState<TeamControlPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employeeEdits, setEmployeeEdits] = useState<
    Record<
      string,
      { name: string; phone: string; role: TeamRole; active: boolean }
    >
  >({});
  const [accessEdits, setAccessEdits] = useState<
    Record<
      string,
      { email: string; pin: string; password: string; userId: string }
    >
  >({});
  const [scheduleEdits, setScheduleEdits] = useState<
    Record<
      string,
      {
        userId: string;
        days: string[];
        shiftStart: string;
        shiftEnd: string;
        breakMinutes: string;
        active: boolean;
      }
    >
  >({});

  const [newEmployee, setNewEmployee] = useState({
    name: "",
    phone: "",
    role: "COOK" as TeamRole,
    active: true,
  });
  const [newAccess, setNewAccess] = useState({
    email: "",
    pin: "",
    password: "changeme",
    userId: "",
  });
  const [newSchedule, setNewSchedule] = useState({
    userId: "",
    days: [] as string[],
    shiftStart: "",
    shiftEnd: "",
    breakMinutes: "0",
    active: true,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/team-control", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load (${response.status})`);
      const payload = (await response.json()) as TeamControlPayload;
      setData(payload);

      setEmployeeEdits(
        Object.fromEntries(
          payload.employees.map((employee) => [
            employee.id,
            {
              name: employee.name,
              phone: employee.phone,
              role: (employee.role as TeamRole) || "COOK",
              active: employee.active,
            },
          ]),
        ),
      );

      setAccessEdits(
        Object.fromEntries(
          payload.accesses.map((access) => [
            access.id,
            {
              email: access.email,
              pin: access.pin ?? "",
              password: "",
              userId: access.user?.id ?? "",
            },
          ]),
        ),
      );

      setScheduleEdits(
        Object.fromEntries(
          payload.schedules.map((schedule) => [
            schedule.id,
            {
              userId: schedule.user?.id ?? "",
              days: schedule.days ?? [],
              shiftStart: schedule.shiftStart ?? "",
              shiftEnd: schedule.shiftEnd ?? "",
              breakMinutes: String(schedule.breakMinutes ?? 0),
              active: schedule.active,
            },
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const employees = useMemo(() => data?.employees ?? [], [data]);

  const runMutation = async (
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
  ) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/team-control", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Request failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA TEAM
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">Team Control</h1>
        </div>
        <Link
          href="/cost-control"
          className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700 inline-flex items-center"
        >
          Back cost control
        </Link>
      </header>

      {error ? (
        <AppCard
          className="mb-4 border-slate-700 text-sm text-slate-200"
          as="section"
        >
          {error}
        </AppCard>
      ) : null}
      {loading ? (
        <AppCard className="mb-4 text-sm text-slate-300" as="section">
          Loading team control...
        </AppCard>
      ) : null}

      <section className="space-y-5">
        <AppCard id="team-control-card-employees">
          <h2 className="text-base font-semibold text-slate-100">Employees</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <input
              value={newEmployee.name}
              onChange={(e) =>
                setNewEmployee((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Full name"
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <input
              value={newEmployee.phone}
              onChange={(e) =>
                setNewEmployee((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="Phone / username"
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <select
              value={newEmployee.role}
              onChange={(e) =>
                setNewEmployee((prev) => ({
                  ...prev,
                  role: e.target.value as TeamRole,
                }))
              }
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                runMutation("POST", {
                  entity: "employee",
                  ...newEmployee,
                }).then(() =>
                  setNewEmployee({
                    name: "",
                    phone: "",
                    role: "COOK",
                    active: true,
                  }),
                )
              }
              disabled={
                saving || !newEmployee.name.trim() || !newEmployee.phone.trim()
              }
              className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            >
              Add employee
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Phone</th>
                  <th className="px-2 py-2 text-left">Role</th>
                  <th className="px-2 py-2 text-left">Active</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-2 py-2">
                      <input
                        value={employeeEdits[employee.id]?.name ?? ""}
                        onChange={(e) =>
                          setEmployeeEdits((prev) => ({
                            ...prev,
                            [employee.id]: {
                              ...prev[employee.id],
                              name: e.target.value,
                            },
                          }))
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={employeeEdits[employee.id]?.phone ?? ""}
                        onChange={(e) =>
                          setEmployeeEdits((prev) => ({
                            ...prev,
                            [employee.id]: {
                              ...prev[employee.id],
                              phone: e.target.value,
                            },
                          }))
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={employeeEdits[employee.id]?.role ?? "COOK"}
                        onChange={(e) =>
                          setEmployeeEdits((prev) => ({
                            ...prev,
                            [employee.id]: {
                              ...prev[employee.id],
                              role: e.target.value as TeamRole,
                            },
                          }))
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(employeeEdits[employee.id]?.active)}
                        onChange={(e) =>
                          setEmployeeEdits((prev) => ({
                            ...prev,
                            [employee.id]: {
                              ...prev[employee.id],
                              active: e.target.checked,
                            },
                          }))
                        }
                      />
                    </td>
                    <td className="px-2 py-2 text-right space-x-2">
                      <button
                        onClick={() =>
                          runMutation("PATCH", {
                            entity: "employee",
                            id: employee.id,
                            ...employeeEdits[employee.id],
                          })
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-200 px-3 text-xs font-medium text-slate-900 hover:bg-slate-100"
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          runMutation("DELETE", {
                            entity: "employee",
                            id: employee.id,
                          })
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-800 px-3 text-xs text-slate-200 hover:bg-slate-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard id="team-control-card-access">
          <h2 className="text-base font-semibold text-slate-100">Access</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <select
              value={newAccess.userId}
              onChange={(e) =>
                setNewAccess((prev) => ({ ...prev, userId: e.target.value }))
              }
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            <input
              value={newAccess.email}
              onChange={(e) =>
                setNewAccess((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="Email / username"
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <input
              value={newAccess.pin}
              onChange={(e) =>
                setNewAccess((prev) => ({
                  ...prev,
                  pin: e.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }
              placeholder="PIN"
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <input
              value={newAccess.password}
              onChange={(e) =>
                setNewAccess((prev) => ({ ...prev, password: e.target.value }))
              }
              placeholder="Password"
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <button
              onClick={() =>
                runMutation("POST", { entity: "access", ...newAccess }).then(
                  () =>
                    setNewAccess({
                      userId: "",
                      email: "",
                      pin: "",
                      password: "changeme",
                    }),
                )
              }
              disabled={saving || !newAccess.userId || !newAccess.email.trim()}
              className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60 md:col-span-4"
            >
              Add access
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Employee</th>
                  <th className="px-2 py-2 text-left">Email</th>
                  <th className="px-2 py-2 text-left">PIN</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(data?.accesses ?? []).map((access) => (
                  <tr key={access.id}>
                    <td className="px-2 py-2">
                      <select
                        value={accessEdits[access.id]?.userId ?? ""}
                        onChange={(e) =>
                          setAccessEdits((prev) => ({
                            ...prev,
                            [access.id]: {
                              ...prev[access.id],
                              userId: e.target.value,
                            },
                          }))
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      >
                        <option value="">Select employee</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={accessEdits[access.id]?.email ?? ""}
                        onChange={(e) =>
                          setAccessEdits((prev) => ({
                            ...prev,
                            [access.id]: {
                              ...prev[access.id],
                              email: e.target.value,
                            },
                          }))
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={accessEdits[access.id]?.pin ?? ""}
                        onChange={(e) =>
                          setAccessEdits((prev) => ({
                            ...prev,
                            [access.id]: {
                              ...prev[access.id],
                              pin: e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 4),
                            },
                          }))
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      />
                    </td>
                    <td className="px-2 py-2 text-right space-x-2">
                      <button
                        onClick={() =>
                          runMutation("PATCH", {
                            entity: "access",
                            id: access.id,
                            ...accessEdits[access.id],
                          })
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-200 px-3 text-xs font-medium text-slate-900 hover:bg-slate-100"
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          runMutation("DELETE", {
                            entity: "access",
                            id: access.id,
                          })
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-800 px-3 text-xs text-slate-200 hover:bg-slate-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard id="team-control-card-schedules">
          <h2 className="text-base font-semibold text-slate-100">Schedules</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            <select
              value={newSchedule.userId}
              onChange={(e) =>
                setNewSchedule((prev) => ({ ...prev, userId: e.target.value }))
              }
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={newSchedule.shiftStart}
              onChange={(e) =>
                setNewSchedule((prev) => ({
                  ...prev,
                  shiftStart: e.target.value,
                }))
              }
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <input
              type="time"
              value={newSchedule.shiftEnd}
              onChange={(e) =>
                setNewSchedule((prev) => ({
                  ...prev,
                  shiftEnd: e.target.value,
                }))
              }
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <input
              type="number"
              value={newSchedule.breakMinutes}
              onChange={(e) =>
                setNewSchedule((prev) => ({
                  ...prev,
                  breakMinutes: e.target.value,
                }))
              }
              placeholder="Break min"
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <div className="flex flex-wrap gap-1 rounded border border-slate-700 bg-slate-950 px-2 py-1">
              {dayOptions.map((day) => {
                const selected = newSchedule.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      setNewSchedule((prev) => ({
                        ...prev,
                        days: selected
                          ? prev.days.filter((entry) => entry !== day)
                          : [...prev.days, day],
                      }))
                    }
                    className={`rounded border px-1 py-0.5 text-xs ${
                      selected
                        ? "border-slate-500 bg-slate-700 text-slate-50"
                        : "border-slate-700 bg-slate-950 text-slate-300"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() =>
                runMutation("POST", {
                  entity: "schedule",
                  ...newSchedule,
                  breakMinutes: Number(newSchedule.breakMinutes || 0),
                }).then(() =>
                  setNewSchedule({
                    userId: "",
                    days: [],
                    shiftStart: "",
                    shiftEnd: "",
                    breakMinutes: "0",
                    active: true,
                  }),
                )
              }
              disabled={
                saving ||
                !newSchedule.userId ||
                !newSchedule.shiftStart ||
                !newSchedule.shiftEnd
              }
              className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60 md:col-span-5"
            >
              Add schedule
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Employee</th>
                  <th className="px-2 py-2 text-left">Days</th>
                  <th className="px-2 py-2 text-left">Shift</th>
                  <th className="px-2 py-2 text-left">Break</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(data?.schedules ?? []).map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="px-2 py-2">
                      <select
                        value={scheduleEdits[schedule.id]?.userId ?? ""}
                        onChange={(e) =>
                          setScheduleEdits((prev) => ({
                            ...prev,
                            [schedule.id]: {
                              ...prev[schedule.id],
                              userId: e.target.value,
                            },
                          }))
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      >
                        <option value="">Select employee</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {dayOptions.map((day) => {
                          const selected = (
                            scheduleEdits[schedule.id]?.days ?? []
                          ).includes(day);
                          return (
                            <button
                              key={`${schedule.id}-${day}`}
                              type="button"
                              onClick={() =>
                                setScheduleEdits((prev) => ({
                                  ...prev,
                                  [schedule.id]: {
                                    ...prev[schedule.id],
                                    days: selected
                                      ? prev[schedule.id].days.filter(
                                          (entry) => entry !== day,
                                        )
                                      : [...prev[schedule.id].days, day],
                                  },
                                }))
                              }
                              className={`rounded border px-1 py-0.5 text-xs ${
                                selected
                                  ? "border-slate-500 bg-slate-700 text-slate-50"
                                  : "border-slate-700 bg-slate-950 text-slate-300"
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <input
                          type="time"
                          value={scheduleEdits[schedule.id]?.shiftStart ?? ""}
                          onChange={(e) =>
                            setScheduleEdits((prev) => ({
                              ...prev,
                              [schedule.id]: {
                                ...prev[schedule.id],
                                shiftStart: e.target.value,
                              },
                            }))
                          }
                          className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                        />
                        <input
                          type="time"
                          value={scheduleEdits[schedule.id]?.shiftEnd ?? ""}
                          onChange={(e) =>
                            setScheduleEdits((prev) => ({
                              ...prev,
                              [schedule.id]: {
                                ...prev[schedule.id],
                                shiftEnd: e.target.value,
                              },
                            }))
                          }
                          className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={scheduleEdits[schedule.id]?.breakMinutes ?? "0"}
                        onChange={(e) =>
                          setScheduleEdits((prev) => ({
                            ...prev,
                            [schedule.id]: {
                              ...prev[schedule.id],
                              breakMinutes: e.target.value,
                            },
                          }))
                        }
                        className="h-9 w-20 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      />
                    </td>
                    <td className="px-2 py-2 text-right space-x-2">
                      <button
                        onClick={() =>
                          runMutation("PATCH", {
                            entity: "schedule",
                            id: schedule.id,
                            ...scheduleEdits[schedule.id],
                            breakMinutes: Number(
                              scheduleEdits[schedule.id]?.breakMinutes ?? 0,
                            ),
                          })
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-200 px-3 text-xs font-medium text-slate-900 hover:bg-slate-100"
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          runMutation("DELETE", {
                            entity: "schedule",
                            id: schedule.id,
                          })
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-800 px-3 text-xs text-slate-200 hover:bg-slate-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>
      </section>
    </main>
  );
}
