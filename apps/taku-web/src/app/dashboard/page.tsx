"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  clearStoredSession,
  getSessionHeaders,
  getStoredSession,
  type TakuSession,
} from "../session";

type Business = {
  id: string;
  name: string;
  ownerName: string;
  status: "active" | "trial" | "suspended";
  entitlements?: {
    plan: "paid" | "trial" | "suspended";
    trialDaysRemaining: number | null;
    blockedReason: string | null;
  };
};

type WaConnection = {
  id: string;
  businessId: string;
  connectionId: string;
  name: string;
  phone: string | null;
  state: "inactive" | "starting" | "qr_pending" | "connected" | "error";
  updatedAt: string;
};

type Bot = {
  id: string;
  businessId: string;
  status: "draft" | "active" | "paused";
};

type Assignment = {
  id: string;
  businessId: string;
  active: boolean;
};

type Payment = {
  id: string;
  businessId: string;
  provider: "mock" | "mercadopago";
  status: string;
  amount: number | null;
  currency: string | null;
  paidAt: string | null;
  createdAt: string;
};

type Member = {
  id: string;
  businessId: string;
  role: "superowner" | "owner" | "operator";
  active: boolean;
};

type DashboardData = {
  businesses: Business[];
  waConnections: WaConnection[];
  bots: Bot[];
  assignments: Assignment[];
  payments: Payment[];
  members: Member[];
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_API_BASE_URL ?? "http://localhost:3010";
const apiKey = process.env.NEXT_PUBLIC_TAKU_API_KEY ?? "";

function requestHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
    ...(apiKey ? { "x-api-key": apiKey } : {}),
    ...getSessionHeaders(),
    "x-taku-role": "superowner",
  };
}

async function apiRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: requestHeaders(),
  });
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Request failed with ${response.status}`,
    );
  }

  return body as T;
}

function numberText(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function moneyText(payment: Payment): string {
  if (payment.amount === null) return "-";
  return `${payment.currency ?? "MXN"} ${payment.amount}`;
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 py-8 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

export default function DashboardPage() {
  const [session, setSession] = useState<TakuSession | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredSession();
    if (!stored) {
      window.location.href = "/login";
      return;
    }

    if (stored.session.role !== "superowner") {
      window.location.href = "/onboarding";
      return;
    }

    setSession(stored.session);
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      apiRequest<{ businesses: Business[] }>("/v1/businesses"),
      apiRequest<{ waConnections: WaConnection[] }>("/v1/wa-connections"),
      apiRequest<{ bots: Bot[] }>("/v1/bots"),
      apiRequest<{ assignments: Assignment[] }>("/v1/bot-assignments"),
      apiRequest<{ payments: Payment[] }>("/v1/payments"),
      apiRequest<{ members: Member[] }>("/v1/members"),
    ])
      .then(
        ([businesses, waConnections, bots, assignments, payments, members]) => {
          if (cancelled) return;
          setData({
            businesses: businesses.businesses,
            waConnections: waConnections.waConnections,
            bots: bots.bots,
            assignments: assignments.assignments,
            payments: payments.payments,
            members: members.members,
          });
        },
      )
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Could not load dashboard",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const summary = useMemo(() => {
    const businesses = data?.businesses ?? [];
    const payments = data?.payments ?? [];
    const waConnections = data?.waConnections ?? [];
    const bots = data?.bots ?? [];
    const assignments = data?.assignments ?? [];
    const members = data?.members ?? [];

    return {
      totalBusinesses: businesses.length,
      activeBusinesses: businesses.filter(
        (business) => business.status === "active",
      ).length,
      trialBusinesses: businesses.filter(
        (business) => business.status === "trial",
      ).length,
      suspendedBusinesses: businesses.filter(
        (business) => business.status === "suspended",
      ).length,
      paidPayments: payments.filter((payment) =>
        ["paid", "approved"].includes(payment.status),
      ),
      connectedPhones: waConnections.filter(
        (connection) => connection.state === "connected",
      ).length,
      disconnectedPhones: waConnections.filter(
        (connection) => connection.state !== "connected",
      ).length,
      activeBots: bots.filter((bot) => bot.status === "active").length,
      activeAssignments: assignments.filter((assignment) => assignment.active)
        .length,
      ownerMembers: members.filter((member) => member.role === "owner").length,
      supportItems:
        businesses.filter((business) => business.status === "suspended")
          .length +
        waConnections.filter((connection) => connection.state === "error")
          .length +
        waConnections.filter((connection) => connection.state === "qr_pending")
          .length,
    };
  }, [data]);

  function logout() {
    clearStoredSession();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              TAKU SUPEROWNER
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">
              Platform Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Control view for TAKU client businesses, billing, WhatsApp phones,
              support work, and service health.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-900"
            >
              Admin
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-900"
            >
              Log out
            </button>
          </div>
        </header>

        {loading ? (
          <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
            Loading dashboard...
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100">
            {error}
          </div>
        ) : null}

        {data ? (
          <div className="mt-8 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <Section eyebrow="1. Business overview" title="Client accounts">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Businesses"
                    value={numberText(summary.totalBusinesses)}
                  />
                  <MetricCard
                    title="Active"
                    value={numberText(summary.activeBusinesses)}
                  />
                  <MetricCard
                    title="Trial"
                    value={numberText(summary.trialBusinesses)}
                  />
                  <MetricCard
                    title="Owners"
                    value={numberText(summary.ownerMembers)}
                  />
                </div>
              </Section>

              <Section eyebrow="2. Revenue / billing" title="Payment state">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Paid accounts"
                    value={numberText(summary.activeBusinesses)}
                  />
                  <MetricCard
                    title="Trial accounts"
                    value={numberText(summary.trialBusinesses)}
                  />
                  <MetricCard
                    title="Suspended"
                    value={numberText(summary.suspendedBusinesses)}
                  />
                  <MetricCard
                    title="Payments"
                    value={numberText(summary.paidPayments.length)}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {summary.paidPayments.slice(0, 5).map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm"
                    >
                      <span className="text-slate-100">
                        {payment.provider} / {payment.status}
                      </span>
                      <span className="text-slate-400">
                        {moneyText(payment)}
                      </span>
                    </div>
                  ))}
                  {summary.paidPayments.length === 0 ? (
                    <EmptyState text="No paid payment records yet." />
                  ) : null}
                </div>
              </Section>

              <Section
                eyebrow="3. WhatsApp infrastructure"
                title="Phones, bots, and assignments"
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Connected phones"
                    value={numberText(summary.connectedPhones)}
                  />
                  <MetricCard
                    title="Needs pairing"
                    value={numberText(summary.disconnectedPhones)}
                  />
                  <MetricCard
                    title="Active bots"
                    value={numberText(summary.activeBots)}
                  />
                  <MetricCard
                    title="Assignments"
                    value={numberText(summary.activeAssignments)}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {data.waConnections.slice(0, 5).map((connection) => (
                    <div
                      key={connection.id}
                      className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm md:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <p className="font-semibold text-slate-100">
                          {connection.name}
                        </p>
                        <p className="text-slate-400">
                          {connection.phone ?? connection.connectionId}
                        </p>
                      </div>
                      <span className="text-slate-300">{connection.state}</span>
                    </div>
                  ))}
                  {data.waConnections.length === 0 ? (
                    <EmptyState text="No WhatsApp phones created yet." />
                  ) : null}
                </div>
              </Section>
            </div>

            <div className="space-y-5">
              <Section eyebrow="4. Support queue" title="Accounts to inspect">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard
                    title="Open items"
                    value={numberText(summary.supportItems)}
                  />
                  <MetricCard
                    title="Suspended"
                    value={numberText(summary.suspendedBusinesses)}
                  />
                  <MetricCard
                    title="QR pending"
                    value={numberText(
                      data.waConnections.filter(
                        (connection) => connection.state === "qr_pending",
                      ).length,
                    )}
                  />
                  <MetricCard
                    title="Errors"
                    value={numberText(
                      data.waConnections.filter(
                        (connection) => connection.state === "error",
                      ).length,
                    )}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {data.businesses
                    .filter((business) => business.status !== "active")
                    .slice(0, 5)
                    .map((business) => (
                      <div
                        key={business.id}
                        className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm"
                      >
                        <p className="font-semibold text-slate-100">
                          {business.name}
                        </p>
                        <p className="text-slate-400">
                          {business.status} / {business.ownerName}
                        </p>
                      </div>
                    ))}
                  {summary.supportItems === 0 ? (
                    <EmptyState text="No urgent support items." />
                  ) : null}
                </div>
              </Section>

              <Section eyebrow="5. Platform health" title="Runtime overview">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard title="TAKU Web" value="online" />
                  <MetricCard title="TAKU API" value="online" />
                  <MetricCard
                    title="WA records"
                    value={numberText(data.waConnections.length)}
                  />
                  <MetricCard title="JSON store" value="ready" />
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  This dashboard reads the TAKU API JSON store directly through
                  the existing service endpoints. WA socket health is
                  represented by the phone states stored by TAKU API.
                </p>
              </Section>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
