"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, FlaskConical } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { takuList } from "@/lib/taku-api";
import {
  fetchDayCloses,
  fetchWeekCloses,
  type DayCloseRecord,
  type WeekCloseRecord,
} from "@/components/inbox/api";
import { cx } from "@/components/inbox/helpers";
import {
  listDeliveryOrders,
  orderStatus,
} from "@/components/inbox/pendingOrders";
import { formatMxn } from "@/components/inbox/raiseOrder";
import {
  buildInsightReport,
  money,
  todayDateKey,
  type InsightBucket,
  type InsightMovement,
  type InsightShare,
  type PeriodKind,
} from "./aggregate";

const PERIODS: Array<{ id: PeriodKind; label: string }> = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "12m", label: "12 meses" },
];

const MOCKS = [
  { label: "Entregas a tiempo", value: "86%" },
  { label: "Tiempo promedio de entrega", value: "34 min" },
  { label: "Clientes que repiten", value: "28%" },
];

const GRID = "#e2e8f0";
const TICK = "#64748b";
const INCOME = mixWhite("#047857");
const EXPENSE = mixWhite("#e11d48");
const NET = mixWhite("#09090b");

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 12,
  color: "#020617",
};

function mixWhite(hex: string, white = 0.6) {
  const value = Number.parseInt(hex.slice(1), 16);
  const mix = (channel: number) =>
    Math.round(channel * (1 - white) + 255 * white);
  return `#${[mix((value >> 16) & 255), mix((value >> 8) & 255), mix(value & 255)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (Array.isArray(value)) return asNumber(value[0]);
  return 0;
}

function formatSignedMxn(amount: number) {
  const text = formatMxn(Math.abs(amount));
  if (amount > 0) return `+${text}`;
  if (amount < 0) return `−${text}`;
  return text;
}

function formatSignedCount(amount: number) {
  if (amount > 0) return `+${amount}`;
  if (amount < 0) return `−${Math.abs(amount)}`;
  return "0";
}

function axisMoney(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function longDateLabel(key: string) {
  const dayKey = key.length === 7 ? `${key}-01` : key;
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return key;
  return new Intl.DateTimeFormat("es-MX", {
    day: key.length === 7 ? undefined : "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function movementDate(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return dayKey;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function bucketTitle(payload: ReadonlyArray<{ payload?: InsightBucket }>) {
  const key = payload[0]?.payload?.key;
  return key ? longDateLabel(key) : "";
}

export function InsightsDashboard() {
  const [period, setPeriod] = useState<PeriodKind>("12m");
  const [days, setDays] = useState<DayCloseRecord[] | null>(null);
  const [weeks, setWeeks] = useState<WeekCloseRecord[] | null>(null);
  const [expenses, setExpenses] = useState<InsightExpenseRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openOrders, setOpenOrders] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading) {
      setShowLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLoading(true), 200);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    setOpenOrders(
      listDeliveryOrders().filter((order) => orderStatus(order) === "open")
        .length,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void Promise.all([
      fetchDayCloses(),
      fetchWeekCloses(),
      takuList<InsightExpenseRow>("/expenses"),
    ])
      .then(([nextDays, nextWeeks, nextExpenses]) => {
        if (cancelled) return;
        setDays(nextDays);
        setWeeks(nextWeeks);
        setExpenses(nextExpenses);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setDays(null);
        setWeeks(null);
        setExpenses(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudo cargar el analisis.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const report = useMemo(() => {
    if (!days || !weeks || !expenses) return null;
    return buildInsightReport({
      today: todayDateKey(),
      period,
      days,
      expenses,
      weeks,
    });
  }, [days, expenses, period, weeks]);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 md:gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">
          Analisis de pedidos y ventas
        </h1>
        <p className="text-sm text-slate-600">
          Ventas de los cierres de caja y gastos del dia. El costo de comida
          queda en el cierre semanal.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {PERIODS.map((item) => {
          const selected = period === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPeriod(item.id)}
              className={cx(
                "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2",
                selected
                  ? "bg-slate-950 text-slate-50"
                  : "border border-slate-300 bg-white text-slate-950 hover:bg-slate-50",
              )}
            >
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {openOrders == null ? null : (
        <p className="text-sm text-slate-600">
          Pedidos abiertos en este navegador: {openOrders}. El historico sale
          de los cierres de caja.
        </p>
      )}

      {isLoading && !report ? (
        <div
          className="flex min-h-24 items-center justify-center"
          aria-busy="true"
        >
          {showLoading ? (
            <span
              className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950 motion-reduce:animate-none"
              role="status"
              aria-label="Cargando"
            />
          ) : null}
        </div>
      ) : error && !report ? (
        <p className="text-sm text-slate-700">{error}</p>
      ) : report ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Kpi
              label="Ingresos"
              value={formatMxn(report.totals.ingresos)}
              delta={`${formatSignedMxn(money(report.totals.ingresos - report.previousTotals.ingresos))} vs periodo anterior`}
            />
            <Kpi
              label="Gastos"
              value={formatMxn(report.totals.gastos)}
              delta={`${formatSignedMxn(money(report.totals.gastos - report.previousTotals.gastos))} vs periodo anterior`}
            />
            <Kpi
              label="Neto"
              value={formatSignedMxn(report.totals.neto)}
              delta={`${formatSignedMxn(money(report.totals.neto - report.previousTotals.neto))} vs periodo anterior`}
            />
            <Kpi
              label="Pedidos"
              value={String(report.totals.pedidos)}
              delta={`${formatSignedCount(report.totals.pedidos - report.previousTotals.pedidos)} vs periodo anterior`}
            />
            <Kpi
              label="Ticket promedio"
              value={
                report.totals.ticket == null
                  ? "Sin pedidos"
                  : formatMxn(report.totals.ticket)
              }
              delta={ticketDelta(
                report.totals.ticket,
                report.previousTotals.ticket,
              )}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {MOCKS.map((item) => (
              <article
                key={item.label}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-600">{item.label}</p>
                  <FlaskConical
                    className="size-4 shrink-0 text-slate-600"
                    aria-label="Dato simulado"
                  />
                </div>
                <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  {item.value}
                </p>
              </article>
            ))}
          </section>

          <ChartCard title="Ingresos y gastos">
            {report.hasFlow ? (
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.buckets}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: TICK, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={16}
                    />
                    <YAxis
                      tickFormatter={axisMoney}
                      tick={{ fill: TICK, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        name === "Gastos −"
                          ? `−${formatMxn(Math.abs(asNumber(value)))}`
                          : `+${formatMxn(Math.abs(asNumber(value)))}`,
                        name,
                      ]}
                      labelFormatter={(_label, payload) =>
                        bucketTitle(
                          payload as ReadonlyArray<{ payload?: InsightBucket }>,
                        )
                      }
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Legend />
                    <Bar
                      dataKey="ingresos"
                      name="Ingresos +"
                      fill={INCOME}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="gastos"
                      name="Gastos −"
                      fill={EXPENSE}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyCopy>No hay movimientos en este periodo.</EmptyCopy>
            )}
          </ChartCard>

          <ChartCard title="Neto">
            {report.hasFlow ? (
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={report.buckets}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: TICK, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={16}
                    />
                    <YAxis
                      tickFormatter={axisMoney}
                      tick={{ fill: TICK, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatSignedMxn(asNumber(value)),
                        name,
                      ]}
                      labelFormatter={(_label, payload) =>
                        bucketTitle(
                          payload as ReadonlyArray<{ payload?: InsightBucket }>,
                        )
                      }
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="neto"
                      name="Neto"
                      stroke={NET}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyCopy>No hay movimientos en este periodo.</EmptyCopy>
            )}
          </ChartCard>

          <ChartCard title="Gastos por concepto">
            {report.expenseShares.length > 0 ? (
              <ShareChart
                items={report.expenseShares}
                fill={EXPENSE}
                sign="−"
              />
            ) : (
              <EmptyCopy>No hay gastos por concepto en este periodo.</EmptyCopy>
            )}
          </ChartCard>

          <ChartCard title="Costos del cierre semanal">
            {report.weekCount === 0 ? (
              <EmptyCopy>No hay un cierre semanal en este periodo.</EmptyCopy>
            ) : report.weekShares.length === 0 ? (
              <EmptyCopy>
                El cierre semanal no tiene costos en este periodo.
              </EmptyCopy>
            ) : (
              <div className="grid gap-4">
                <p className="text-sm text-slate-600">
                  Neto de los cierres: {formatSignedMxn(report.weekNeto)}. Estos
                  costos no se suman a los gastos de arriba.
                </p>
                <ShareChart items={report.weekShares} fill={EXPENSE} sign="−" />
              </div>
            )}
          </ChartCard>

          <ChartCard title="Efectivo y banco">
            {report.paymentShares.length > 0 ? (
              <ShareChart items={report.paymentShares} fill={INCOME} sign="+" />
            ) : (
              <EmptyCopy>No hay cierres de caja en este periodo.</EmptyCopy>
            )}
          </ChartCard>

          <ChartCard title="Mojarras y empanadas">
            {report.productShares.length > 0 ? (
              <ShareChart items={report.productShares} fill={NET} sign={null} />
            ) : (
              <EmptyCopy>No hay cierres de caja en este periodo.</EmptyCopy>
            )}
          </ChartCard>

          <section className="grid gap-4">
            <h2 className="text-base font-medium text-slate-950">
              Movimientos
            </h2>
            {report.movements.length === 0 ? (
              <EmptyCopy>No hay movimientos en este periodo.</EmptyCopy>
            ) : (
              <ul className="grid gap-2">
                {report.movements.map((item) => (
                  <MovementRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

type InsightExpenseRow = {
  id: string;
  date: string;
  concept: string;
  amount: number;
};

function ticketDelta(current: number | null, previous: number | null) {
  if (current != null && previous != null) {
    return `${formatSignedMxn(money(current - previous))} vs periodo anterior`;
  }
  if (current != null) return "Sin pedidos en el periodo anterior";
  if (previous != null) {
    return `El periodo anterior cerro en ${formatMxn(previous)}`;
  }
  return "El periodo anterior tampoco tuvo pedidos";
}

function Kpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-600">{delta}</p>
    </article>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-medium text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function EmptyCopy({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-600">{children}</p>;
}

function ShareChart({
  items,
  fill,
  sign,
}: {
  items: InsightShare[];
  fill: string;
  sign: "+" | "−" | null;
}) {
  return (
    <div className="grid gap-4">
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={items}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={112}
              tick={{ fill: TICK, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, _name, item) => {
                const row = item.payload as InsightShare;
                const amount = asNumber(value);
                const text =
                  sign == null
                    ? String(amount)
                    : `${sign}${formatMxn(Math.abs(amount))}`;
                return [`${text} · ${row.percent}%`, row.name];
              }}
              contentStyle={TOOLTIP_STYLE}
            />
            <Bar
              dataKey="amount"
              name="Importe"
              fill={fill}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li
            key={item.name}
            className="flex items-baseline justify-between gap-2 text-sm"
          >
            <span className="min-w-0 text-slate-950">{item.name}</span>
            <span className="shrink-0 text-slate-600">
              {sign == null
                ? item.amount
                : `${sign}${formatMxn(Math.abs(item.amount))}`}{" "}
              · {item.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MovementRow({ item }: { item: InsightMovement }) {
  const sign = item.kind === "ingreso" ? "+" : "−";
  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-950">{item.label}</p>
        <p className="text-xs text-slate-600">
          {movementDate(item.date)} ·{" "}
          {item.kind === "ingreso" ? "Ingreso" : "Gasto"}
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-slate-950">
        {sign}
        {formatMxn(item.amount)}
      </p>
    </li>
  );
}
