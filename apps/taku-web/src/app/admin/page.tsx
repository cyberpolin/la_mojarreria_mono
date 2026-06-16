"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  clearStoredSession,
  getSessionHeaders,
  getStoredSession,
  type TakuSession,
} from "../session";

type Role = "superowner" | "client";
type ConnectionState =
  | "connected"
  | "qr_pending"
  | "inactive"
  | "starting"
  | "error";
type BotStatus = "draft" | "active" | "paused";
type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type ActiveSchedule = {
  days: Weekday[];
  startTime: string;
  endTime: string;
};

type BusinessEntitlements = {
  plan: "paid" | "trial" | "suspended";
  canUseBots: boolean;
  canCreateBot: boolean;
  botLimit: number | null;
  botsUsed: number;
  canUseSchedules: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  blockedReason: string | null;
};

type Business = {
  id: string;
  name: string;
  ownerName: string;
  status: "active" | "trial" | "suspended";
  entitlements?: BusinessEntitlements;
};

type BusinessMember = {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: "superowner" | "owner" | "operator";
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type PaymentRecord = {
  id: string;
  businessId: string;
  provider: "mock" | "mercadopago";
  providerPaymentId: string;
  providerPreferenceId: string | null;
  status: string;
  amount: number | null;
  currency: string | null;
  paidAt: string | null;
  rawProviderStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

type WaConnection = {
  id: string;
  businessId: string;
  connectionId: string;
  name: string;
  description: string;
  phone: string | null;
  state: ConnectionState;
  activeSchedule: ActiveSchedule | null;
  updatedAt: string;
};

type Bot = {
  id: string;
  businessId: string;
  name: string;
  status: BotStatus;
  instructions: string;
};

type BotAssignment = {
  id: string;
  businessId: string;
  botId: string;
  waConnectionId: string;
  active: boolean;
};

type PairingResponse = {
  waConnection: WaConnection;
  pairing: {
    qr: string | null;
    qrImage: string | null;
    connection: {
      connected: boolean;
      hasQr: boolean;
      state: string;
    };
  };
};

type PairingStatusResponse = {
  waConnection: WaConnection;
  pairing: {
    connected: boolean;
    hasQr: boolean;
    state: string;
  };
};

type PairingView = {
  qrImage: string | null;
  connected: boolean;
  loading: boolean;
};

type TakuData = {
  businesses: Business[];
  members: BusinessMember[];
  waConnections: WaConnection[];
  bots: Bot[];
  assignments: BotAssignment[];
  payments: PaymentRecord[];
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_API_BASE_URL ?? "http://localhost:3010";
const apiKey = process.env.NEXT_PUBLIC_TAKU_API_KEY ?? "";
const clientBusinessId = "business_001";

const stateLabels: Record<ConnectionState, string> = {
  connected: "Connected",
  qr_pending: "QR pending",
  inactive: "Inactive",
  starting: "Starting",
  error: "Error",
};

const botStatusLabels: Record<BotStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
};

const planLabels: Record<BusinessEntitlements["plan"], string> = {
  paid: "Paid",
  trial: "Trial",
  suspended: "Suspended",
};

const weekdayLabels: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const weekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function requestHeaders(role: Role): HeadersInit {
  return {
    "content-type": "application/json",
    ...(apiKey ? { "x-api-key": apiKey } : {}),
    ...getSessionHeaders(),
    "x-taku-role": role,
    "x-taku-business-id": clientBusinessId,
  };
}

async function apiRequest<T>(
  path: string,
  role: Role,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...requestHeaders(role),
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | T
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-lg border border-slate-700 px-2.5 text-xs font-medium text-slate-200">
      {children}
    </span>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-slate-800 px-4">
        <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
  );
}

function ConnectedMark() {
  return (
    <div className="flex h-64 w-64 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-500 bg-slate-100 text-3xl font-semibold text-slate-950">
        OK
      </span>
      <span className="mt-4 text-sm font-semibold text-slate-50">
        Connected
      </span>
      <span className="mt-1 text-xs text-slate-400">
        WhatsApp pairing is complete.
      </span>
    </div>
  );
}

function QrPairingPanel({
  qrImage,
  loading,
  connected,
  label,
}: {
  qrImage: string | null;
  loading: boolean;
  connected: boolean;
  label: string;
}) {
  if (connected) {
    return <ConnectedMark />;
  }

  if (!qrImage && !loading) {
    return null;
  }

  return (
    <div className="relative inline-block rounded-lg border border-slate-800 bg-white p-3">
      {qrImage ? (
        <img src={qrImage} alt={label} className="h-64 w-64" />
      ) : (
        <div className="h-64 w-64 bg-slate-100" />
      )}
      {loading ? (
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-md bg-slate-950/75 text-slate-50">
          <LoadingSpinner />
          <span className="mt-3 text-sm font-medium">Pairing...</span>
        </div>
      ) : null}
    </div>
  );
}

function formatSchedule(schedule: ActiveSchedule | null) {
  if (!schedule) return "Always active";

  const days = schedule.days.map((day) => weekdayLabels[day]).join(", ");
  return `${days} ${schedule.startTime}-${schedule.endTime}`;
}

function defaultSchedule(): ActiveSchedule {
  return {
    days: ["mon", "tue", "wed", "thu", "fri"],
    startTime: "09:00",
    endTime: "18:00",
  };
}

function updatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated recently";
  return `Updated ${date.toLocaleString()}`;
}

function dateLabel(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString();
}

function formatMoney(amount: number | null, currency: string | null) {
  if (amount === null) return "Amount pending";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency ?? "MXN",
  }).format(amount);
}

function SuspendedAccountBlocker({
  businessName,
  payHref,
}: {
  businessName: string;
  payHref: string;
}) {
  const showDevLogout = process.env.NODE_ENV === "development";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Account suspended
        </p>
        <h2 className="mt-3 text-xl font-semibold text-slate-50">
          Payment required
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {businessName} is currently suspended. Reactivate the account to use
          WhatsApp connections, bots, schedules, and pairing tools.
        </p>
        <Link
          href={payHref}
          className="mt-6 flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
        >
          Pay now
        </Link>
        {showDevLogout ? (
          <button
            type="button"
            onClick={() => {
              clearStoredSession();
              window.location.href = "/login";
            }}
            className="mt-3 min-h-11 w-full rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
          >
            Dev logout
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [role, setRole] = useState<Role>("superowner");
  const [session, setSession] = useState<TakuSession | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] =
    useState(clientBusinessId);
  const [data, setData] = useState<TakuData>({
    businesses: [],
    members: [],
    waConnections: [],
    bots: [],
    assignments: [],
    payments: [],
  });
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [phoneName, setPhoneName] = useState("");
  const [phoneDescription, setPhoneDescription] = useState("");
  const [botName, setBotName] = useState("");
  const [botInstructions, setBotInstructions] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pairingViews, setPairingViews] = useState<Record<string, PairingView>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredSession();
    setSession(stored?.session ?? null);
    if (stored?.session.role) {
      setRole(stored.session.role);
    }
    if (stored?.session.businessId) {
      setSelectedBusinessId(stored.session.businessId);
    }
  }, []);

  async function loadData(nextRole = role) {
    setLoading(true);
    setError(null);

    try {
      const [
        businessesBody,
        membersBody,
        paymentsBody,
        connectionsBody,
        botsBody,
        assignmentsBody,
      ] = await Promise.all([
        apiRequest<{ businesses: Business[] }>("/v1/businesses", nextRole),
        apiRequest<{ members: BusinessMember[] }>("/v1/members", nextRole),
        apiRequest<{ payments: PaymentRecord[] }>("/v1/payments", nextRole),
        apiRequest<{ waConnections: WaConnection[] }>(
          "/v1/wa-connections",
          nextRole,
        ),
        apiRequest<{ bots: Bot[] }>("/v1/bots", nextRole),
        apiRequest<{ assignments: BotAssignment[] }>(
          "/v1/bot-assignments",
          nextRole,
        ),
      ]);

      setData({
        businesses: businessesBody.businesses,
        members: membersBody.members,
        waConnections: connectionsBody.waConnections,
        bots: botsBody.bots,
        assignments: assignmentsBody.assignments,
        payments: paymentsBody.payments,
      });
      void refreshConnectionStatuses(connectionsBody.waConnections, nextRole);

      const firstBusiness = businessesBody.businesses[0];
      setSelectedBusinessId((current) =>
        businessesBody.businesses.some((business) => business.id === current)
          ? current
          : (firstBusiness?.id ?? clientBusinessId),
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load TAKU",
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshConnectionStatuses(
    connections: WaConnection[],
    nextRole = role,
  ) {
    await Promise.all(
      connections.map(async (connection) => {
        try {
          const body = await apiRequest<PairingStatusResponse>(
            `/v1/wa-connections/${connection.id}/pairing/status`,
            nextRole,
          );

          setData((current) => ({
            ...current,
            waConnections: current.waConnections.map((item) =>
              item.id === connection.id ? body.waConnection : item,
            ),
          }));
          setPairingViews((current) => ({
            ...current,
            [connection.id]: {
              qrImage: current[connection.id]?.qrImage ?? null,
              connected: body.pairing.connected,
              loading: false,
            },
          }));
        } catch {
          // Keep database state if WA Service is unavailable for one phone.
        }
      }),
    );
  }

  useEffect(() => {
    void loadData(role);
  }, [role]);

  const selectedBusiness =
    data.businesses.find((business) => business.id === selectedBusinessId) ??
    data.businesses[0];

  const visibleConnections = useMemo(
    () =>
      selectedBusiness
        ? data.waConnections.filter(
            (connection) => connection.businessId === selectedBusiness.id,
          )
        : [],
    [data.waConnections, selectedBusiness],
  );

  const visibleBots = useMemo(
    () =>
      selectedBusiness
        ? data.bots.filter((bot) => bot.businessId === selectedBusiness.id)
        : [],
    [data.bots, selectedBusiness],
  );

  const selectedBot =
    visibleBots.find((bot) => bot.id === selectedBotId) ?? visibleBots[0];

  const selectedBotAssignments = selectedBot
    ? data.assignments.filter(
        (assignment) => assignment.botId === selectedBot.id,
      )
    : [];
  const selectedEntitlements = selectedBusiness?.entitlements ?? null;
  const canCreateBot = selectedEntitlements?.canCreateBot ?? true;
  const canUseSchedules = selectedEntitlements?.canUseSchedules ?? true;
  const showSuspendedBlocker =
    selectedEntitlements?.plan === "suspended" && role === "client";
  const userPaymentRows = useMemo(() => {
    return data.members
      .filter((member) => member.role !== "superowner")
      .map((member) => {
        const business =
          data.businesses.find((item) => item.id === member.businessId) ?? null;
        const payments = data.payments
          .filter((payment) => payment.businessId === member.businessId)
          .sort((left, right) => {
            const leftDate = left.paidAt ?? left.updatedAt;
            const rightDate = right.paidAt ?? right.updatedAt;
            return new Date(rightDate).getTime() - new Date(leftDate).getTime();
          });

        return {
          member,
          business,
          latestPayment: payments[0] ?? null,
          paymentCount: payments.length,
        };
      });
  }, [data.businesses, data.members, data.payments]);

  useEffect(() => {
    const candidates = visibleConnections.filter(
      (connection) =>
        connection.state === "starting" ||
        connection.state === "qr_pending" ||
        Boolean(pairingViews[connection.id]?.qrImage),
    );

    if (!candidates.length) return;

    const intervalId = window.setInterval(() => {
      void Promise.all(
        candidates.map(async (connection) => {
          try {
            const body = await apiRequest<PairingStatusResponse>(
              `/v1/wa-connections/${connection.id}/pairing/status`,
              role,
            );

            setData((current) => ({
              ...current,
              waConnections: current.waConnections.map((item) =>
                item.id === connection.id ? body.waConnection : item,
              ),
            }));
            setPairingViews((current) => ({
              ...current,
              [connection.id]: {
                qrImage: current[connection.id]?.qrImage ?? null,
                connected: body.pairing.connected,
                loading: false,
              },
            }));
          } catch {
            // Keep the current QR visible; explicit actions surface errors.
          }
        }),
      );
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [pairingViews, role, visibleConnections]);

  useEffect(() => {
    if (!selectedBot || selectedBot.id === selectedBotId) return;
    setSelectedBotId(selectedBot.id);
  }, [selectedBot, selectedBotId]);

  async function addConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBusiness || !phoneName.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const body = await apiRequest<{ waConnection: WaConnection }>(
        "/v1/wa-connections",
        role,
        {
          method: "POST",
          body: JSON.stringify({
            businessId: selectedBusiness.id,
            name: phoneName.trim(),
            description:
              phoneDescription.trim() || "No description configured yet.",
            activeSchedule: null,
          }),
        },
      );

      setData((current) => ({
        ...current,
        waConnections: [...current.waConnections, body.waConnection],
      }));
      setPhoneName("");
      setPhoneDescription("");
      setNotice(`${body.waConnection.connectionId} created in TAKU API.`);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to add phone",
      );
    } finally {
      setSaving(false);
    }
  }

  async function patchConnection(
    connectionId: string,
    patch: Partial<Pick<WaConnection, "state" | "activeSchedule">>,
  ) {
    setSaving(true);
    setError(null);

    try {
      const body = await apiRequest<{ waConnection: WaConnection }>(
        `/v1/wa-connections/${connectionId}`,
        role,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );

      setData((current) => ({
        ...current,
        waConnections: current.waConnections.map((connection) =>
          connection.id === connectionId ? body.waConnection : connection,
        ),
      }));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to update phone",
      );
    } finally {
      setSaving(false);
    }
  }

  async function startPairing(connectionId: string) {
    setSaving(true);
    setError(null);
    setPairingViews((current) => ({
      ...current,
      [connectionId]: {
        qrImage: current[connectionId]?.qrImage ?? null,
        connected: current[connectionId]?.connected ?? false,
        loading: true,
      },
    }));

    try {
      const body = await apiRequest<PairingResponse>(
        `/v1/wa-connections/${connectionId}/pairing/start`,
        role,
        { method: "POST" },
      );

      setData((current) => ({
        ...current,
        waConnections: current.waConnections.map((connection) =>
          connection.id === connectionId ? body.waConnection : connection,
        ),
      }));
      setPairingViews((current) => ({
        ...current,
        [connectionId]: {
          qrImage: body.pairing.qrImage,
          connected: body.pairing.connection.connected,
          loading: false,
        },
      }));
      setNotice(
        body.pairing.qrImage
          ? "Scan the QR code with WhatsApp to complete pairing."
          : "Pairing started. QR is not available yet; try QR again in a moment.",
      );
    } catch (nextError) {
      setPairingViews((current) => ({
        ...current,
        [connectionId]: {
          qrImage: current[connectionId]?.qrImage ?? null,
          connected: current[connectionId]?.connected ?? false,
          loading: false,
        },
      }));
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to start pairing",
      );
    } finally {
      setSaving(false);
    }
  }

  async function refreshPairingQr(connectionId: string) {
    setSaving(true);
    setError(null);
    setPairingViews((current) => ({
      ...current,
      [connectionId]: {
        qrImage: current[connectionId]?.qrImage ?? null,
        connected: current[connectionId]?.connected ?? false,
        loading: true,
      },
    }));

    try {
      const body = await apiRequest<PairingResponse>(
        `/v1/wa-connections/${connectionId}/pairing/qr`,
        role,
      );

      setData((current) => ({
        ...current,
        waConnections: current.waConnections.map((connection) =>
          connection.id === connectionId ? body.waConnection : connection,
        ),
      }));
      setPairingViews((current) => ({
        ...current,
        [connectionId]: {
          qrImage: body.pairing.qrImage,
          connected: body.pairing.connection.connected,
          loading: false,
        },
      }));
      setNotice(
        body.pairing.qrImage
          ? "QR refreshed."
          : "No QR is available yet. Start pairing first.",
      );
    } catch (nextError) {
      setPairingViews((current) => ({
        ...current,
        [connectionId]: {
          qrImage: current[connectionId]?.qrImage ?? null,
          connected: current[connectionId]?.connected ?? false,
          loading: false,
        },
      }));
      setError(
        nextError instanceof Error ? nextError.message : "Unable to load QR",
      );
    } finally {
      setSaving(false);
    }
  }

  async function unlinkPhone(connectionId: string) {
    setSaving(true);
    setError(null);
    setPairingViews((current) => ({
      ...current,
      [connectionId]: {
        qrImage: current[connectionId]?.qrImage ?? null,
        connected: current[connectionId]?.connected ?? false,
        loading: true,
      },
    }));

    try {
      const body = await apiRequest<{ waConnection: WaConnection }>(
        `/v1/wa-connections/${connectionId}/pairing/unlink`,
        role,
        { method: "POST" },
      );

      setData((current) => ({
        ...current,
        waConnections: current.waConnections.map((connection) =>
          connection.id === connectionId ? body.waConnection : connection,
        ),
      }));
      setPairingViews((current) => {
        const next = { ...current };
        delete next[connectionId];
        return next;
      });
      setNotice("Phone unlinked. Start pairing again to connect it.");
    } catch (nextError) {
      setPairingViews((current) => ({
        ...current,
        [connectionId]: {
          qrImage: current[connectionId]?.qrImage ?? null,
          connected: current[connectionId]?.connected ?? false,
          loading: false,
        },
      }));
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to unlink phone",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBusiness || !botName.trim()) return;
    if (!canCreateBot) {
      setError(
        selectedEntitlements?.blockedReason ??
          "Trial accounts can create one bot. Upgrade to add more.",
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body = await apiRequest<{ bot: Bot }>("/v1/bots", role, {
        method: "POST",
        body: JSON.stringify({
          businessId: selectedBusiness.id,
          name: botName.trim(),
          status: "draft",
          instructions:
            botInstructions.trim() ||
            "Answer only from the business knowledge base and ask staff to follow up when unsure.",
        }),
      });

      setData((current) => ({
        ...current,
        bots: [...current.bots, body.bot],
      }));
      setSelectedBotId(body.bot.id);
      setBotName("");
      setBotInstructions("");
      setNotice(`${body.bot.id} created. Assign it to one or more phones.`);
      void loadData(role);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to create bot",
      );
    } finally {
      setSaving(false);
    }
  }

  async function setBotStatus(botId: string, status: BotStatus) {
    setSaving(true);
    setError(null);

    try {
      const body = await apiRequest<{ bot: Bot }>(`/v1/bots/${botId}`, role, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setData((current) => ({
        ...current,
        bots: current.bots.map((bot) => (bot.id === botId ? body.bot : bot)),
      }));
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to update bot",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleBotAssignment(botId: string, connectionId: string) {
    if (!selectedBusiness) return;

    const existing = data.assignments.find(
      (assignment) =>
        assignment.botId === botId &&
        assignment.waConnectionId === connectionId,
    );

    setSaving(true);
    setError(null);

    try {
      const body = await apiRequest<{ assignment: BotAssignment }>(
        "/v1/bot-assignments",
        role,
        {
          method: "POST",
          body: JSON.stringify({
            businessId: selectedBusiness.id,
            botId,
            waConnectionId: connectionId,
            active: existing ? !existing.active : true,
          }),
        },
      );

      setData((current) => {
        const exists = current.assignments.some(
          (assignment) => assignment.id === body.assignment.id,
        );

        return {
          ...current,
          assignments: exists
            ? current.assignments.map((assignment) =>
                assignment.id === body.assignment.id
                  ? body.assignment
                  : assignment,
              )
            : [...current.assignments, body.assignment],
        };
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to update assignment",
      );
    } finally {
      setSaving(false);
    }
  }

  function getConnectionBotLabel(connectionId: string) {
    const activeAssignment = data.assignments.find(
      (assignment) =>
        assignment.waConnectionId === connectionId && assignment.active,
    );
    const bot = activeAssignment
      ? data.bots.find((item) => item.id === activeAssignment.botId)
      : null;

    return bot?.name ?? "No bot assigned";
  }

  async function setConnectionAlwaysActive(connectionId: string) {
    await patchConnection(connectionId, { activeSchedule: null });
  }

  async function updateConnectionSchedule(
    connectionId: string,
    patch: Partial<ActiveSchedule>,
  ) {
    if (!canUseSchedules) {
      setError("Schedules are available on paid accounts only.");
      return;
    }

    const connection = data.waConnections.find(
      (item) => item.id === connectionId,
    );
    const currentSchedule = connection?.activeSchedule ?? defaultSchedule();
    await patchConnection(connectionId, {
      activeSchedule: { ...currentSchedule, ...patch },
    });
  }

  async function toggleScheduleDay(connectionId: string, day: Weekday) {
    const connection = data.waConnections.find(
      (item) => item.id === connectionId,
    );
    const currentDays =
      connection?.activeSchedule?.days ?? defaultSchedule().days;
    const nextDays = currentDays.includes(day)
      ? currentDays.filter((item) => item !== day)
      : [...currentDays, day];

    await updateConnectionSchedule(connectionId, {
      days: nextDays.length ? nextDays : [day],
    });
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              TAKU
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">
              WhatsApp Control Console
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{session ? session.name : "No session"}</Badge>
            <Link
              href="/login"
              className="flex min-h-10 items-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            >
              Sign in
            </Link>
            {session ? (
              <button
                type="button"
                onClick={() => {
                  clearStoredSession();
                  setSession(null);
                  window.location.href = "/login";
                }}
                className="min-h-10 rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              >
                Sign out
              </button>
            ) : null}
            <Link
              href="/onboarding"
              className="flex min-h-10 items-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            >
              Onboarding
            </Link>
            <Link
              href="/docs"
              className="flex min-h-10 items-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            >
              Docs
            </Link>
            <Badge>{apiBaseUrl}</Badge>
            {!session ? (
              <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1">
                {(["superowner", "client"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setRole(item);
                      setSelectedBusinessId(clientBusinessId);
                    }}
                    className={cx(
                      "min-h-10 rounded-md px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300",
                      role === item
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-300 hover:bg-slate-800 hover:text-slate-50",
                    )}
                  >
                    {item === "superowner" ? "Superowner" : "Client user"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 md:grid-cols-[280px_1fr] md:px-6">
        <aside className="space-y-4">
          <Panel title="Businesses">
            {loading ? (
              <EmptyState text="Loading businesses..." />
            ) : data.businesses.length ? (
              <div className="space-y-2">
                {data.businesses.map((business) => (
                  <button
                    key={business.id}
                    type="button"
                    onClick={() => setSelectedBusinessId(business.id)}
                    className={cx(
                      "flex min-h-16 w-full items-center justify-between rounded-lg border px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300",
                      selectedBusiness?.id === business.id
                        ? "border-slate-500 bg-slate-800"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700",
                    )}
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-100">
                        {business.name}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {business.ownerName}
                      </span>
                    </span>
                    <Badge>{business.status}</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState text="No businesses returned by TAKU API." />
            )}
          </Panel>

          <Panel title="Access Scope">
            <div className="space-y-3 text-sm text-slate-300">
              <p>
                {role === "superowner"
                  ? "Platform admins can inspect all businesses and force session operations."
                  : "Client users can only manage WhatsApp connections for their own business."}
              </p>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                Browser actions now go through `taku-api-service`; raw
                `wa-service` credentials stay behind the API.
              </div>
            </div>
          </Panel>
        </aside>

        <section className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">
              {notice}
            </div>
          ) : null}

          {role === "superowner" ? (
            <Panel
              title="Users & Payments"
              action={<Badge>{userPaymentRows.length} client users</Badge>}
            >
              {loading ? (
                <EmptyState text="Loading users and payments..." />
              ) : userPaymentRows.length ? (
                <div className="space-y-3">
                  {userPaymentRows.map(
                    ({ member, business, latestPayment, paymentCount }) => {
                      const plan = business?.entitlements?.plan ?? "suspended";
                      const selected = business?.id === selectedBusiness?.id;

                      return (
                        <div
                          key={member.id}
                          className={cx(
                            "w-full rounded-lg border p-4",
                            selected
                              ? "border-slate-500 bg-slate-800"
                              : "border-slate-800 bg-slate-950",
                          )}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-slate-50">
                                  {member.name}
                                </span>
                                <Badge>{member.role}</Badge>
                                <Badge>
                                  {member.active
                                    ? "Active user"
                                    : "Inactive user"}
                                </Badge>
                              </div>
                              <p className="mt-1 break-words text-sm text-slate-300">
                                {member.email}
                              </p>
                              <p className="mt-2 text-sm text-slate-400">
                                {business?.name ?? "Business missing"}
                              </p>
                            </div>

                            <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3 lg:w-[520px]">
                              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  Account
                                </p>
                                <p className="mt-2 font-semibold text-slate-50">
                                  {business ? planLabels[plan] : "Missing"}
                                </p>
                              </div>
                              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  Payment
                                </p>
                                <p className="mt-2 font-semibold text-slate-50">
                                  {latestPayment
                                    ? latestPayment.status
                                    : "No payment"}
                                </p>
                              </div>
                              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  Last paid
                                </p>
                                <p className="mt-2 font-semibold text-slate-50">
                                  {latestPayment
                                    ? formatMoney(
                                        latestPayment.amount,
                                        latestPayment.currency,
                                      )
                                    : "Not paid"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            {latestPayment ? (
                              <>
                                <Badge>{latestPayment.provider}</Badge>
                                <span>
                                  Payment {latestPayment.providerPaymentId}
                                </span>
                                <span>{dateLabel(latestPayment.paidAt)}</span>
                                <span>
                                  {paymentCount} total payment records
                                </span>
                              </>
                            ) : business ? (
                              <>
                                <span>No payment record yet.</span>
                                <Link
                                  href={`/payment?businessId=${encodeURIComponent(business.id)}`}
                                  onClick={(event) => event.stopPropagation()}
                                  className="font-medium text-slate-100 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                                >
                                  Open payment
                                </Link>
                              </>
                            ) : (
                              <span>
                                This user references a missing business.
                              </span>
                            )}
                            {business ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedBusinessId(business.id)
                                }
                                className="ml-auto min-h-9 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-100 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                              >
                                Inspect
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              ) : (
                <EmptyState text="No client users returned by TAKU API." />
              )}
            </Panel>
          ) : null}

          {selectedEntitlements ? (
            <Panel title="Account Access">
              {selectedEntitlements.plan === "trial" && selectedBusiness ? (
                <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-50">
                        {selectedEntitlements.trialDaysRemaining ?? 0} trial
                        days left
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Upgrade to unlock unlimited bots and schedules.
                      </p>
                    </div>
                    <Link
                      href={`/payment?businessId=${encodeURIComponent(selectedBusiness.id)}`}
                      className="flex min-h-11 items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                    >
                      Upgrade account
                    </Link>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Plan
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-50">
                    {planLabels[selectedEntitlements.plan]}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Bots
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-50">
                    {selectedEntitlements.botLimit === null
                      ? `${selectedEntitlements.botsUsed} / unlimited`
                      : `${selectedEntitlements.botsUsed} / ${selectedEntitlements.botLimit}`}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Schedules
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-50">
                    {selectedEntitlements.canUseSchedules
                      ? "Enabled"
                      : "Paid only"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Trial
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-50">
                    {selectedEntitlements.trialDaysRemaining === null
                      ? "Not active"
                      : `${selectedEntitlements.trialDaysRemaining} days left`}
                  </p>
                </div>
              </div>
              {selectedEntitlements.blockedReason ? (
                <p className="mt-3 text-sm text-slate-400">
                  {selectedEntitlements.blockedReason}
                </p>
              ) : null}
            </Panel>
          ) : null}

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Business
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-50">
                {selectedBusiness?.name ?? "No business"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Connections
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-50">
                {visibleConnections.length}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Connected
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-50">
                {
                  visibleConnections.filter(
                    (connection) => connection.state === "connected",
                  ).length
                }
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Bots
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-50">
                {visibleBots.length}
              </p>
            </div>
          </div>

          <Panel
            title="Bots"
            action={
              <Badge>
                {saving
                  ? "Saving"
                  : selectedBot
                    ? `${selectedBotAssignments.filter((item) => item.active).length} assigned`
                    : "No bot"}
              </Badge>
            }
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-3">
                {visibleBots.length ? (
                  visibleBots.map((bot) => {
                    const activeAssignments = data.assignments.filter(
                      (assignment) =>
                        assignment.botId === bot.id && assignment.active,
                    ).length;

                    return (
                      <button
                        key={bot.id}
                        type="button"
                        onClick={() => setSelectedBotId(bot.id)}
                        className={cx(
                          "w-full rounded-lg border p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300",
                          selectedBot?.id === bot.id
                            ? "border-slate-500 bg-slate-800"
                            : "border-slate-800 bg-slate-950 hover:border-slate-700",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-50">
                            {bot.name}
                          </span>
                          <Badge>{bot.id}</Badge>
                          <Badge>{botStatusLabels[bot.status]}</Badge>
                          <Badge>
                            {activeAssignments} phone
                            {activeAssignments === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          {bot.instructions}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <EmptyState text="No bots yet for this business." />
                )}
              </div>

              <div className="space-y-4">
                <form
                  onSubmit={addBot}
                  className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4"
                >
                  <h3 className="text-sm font-semibold text-slate-50">
                    Create bot
                  </h3>
                  {!canCreateBot ? (
                    <p className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs leading-5 text-slate-400">
                      {selectedEntitlements?.blockedReason ??
                        "Trial accounts can create one bot. Upgrade to add more."}
                    </p>
                  ) : null}
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">
                      Bot name
                    </span>
                    <input
                      value={botName}
                      onChange={(event) => setBotName(event.target.value)}
                      placeholder="After-hours assistant"
                      disabled={!canCreateBot || saving}
                      className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-50 outline-none placeholder:text-slate-600 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">
                      Instructions
                    </span>
                    <textarea
                      value={botInstructions}
                      onChange={(event) =>
                        setBotInstructions(event.target.value)
                      }
                      rows={4}
                      placeholder="Describe what this bot should handle."
                      disabled={!canCreateBot || saving}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none placeholder:text-slate-600 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      !selectedBusiness ||
                      !botName.trim() ||
                      saving ||
                      !canCreateBot
                    }
                    className="min-h-11 w-full rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Create bot
                  </button>
                </form>

                {selectedBot ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-50">
                        {selectedBot.name}
                      </h3>
                      <select
                        value={selectedBot.status}
                        disabled={saving}
                        onChange={(event) =>
                          void setBotStatus(
                            selectedBot.id,
                            event.target.value as BotStatus,
                          )
                        }
                        className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">
                      {selectedBot.instructions}
                    </p>
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Phone assignments
                      </p>
                      {visibleConnections.length ? (
                        visibleConnections.map((connection) => {
                          const active = data.assignments.some(
                            (assignment) =>
                              assignment.botId === selectedBot.id &&
                              assignment.waConnectionId === connection.id &&
                              assignment.active,
                          );

                          return (
                            <label
                              key={connection.id}
                              className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-slate-800 px-3"
                            >
                              <span>
                                <span className="block text-sm text-slate-100">
                                  {connection.name}
                                </span>
                                <span className="block text-xs text-slate-500">
                                  {connection.connectionId}
                                </span>
                              </span>
                              <input
                                type="checkbox"
                                checked={active}
                                disabled={saving}
                                onChange={() =>
                                  void toggleBotAssignment(
                                    selectedBot.id,
                                    connection.id,
                                  )
                                }
                                className="h-5 w-5"
                              />
                            </label>
                          );
                        })
                      ) : (
                        <EmptyState text="Add a phone before assigning a bot." />
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel
            title="WhatsApp Connections"
            action={
              <Badge>
                {role === "superowner" ? "All controls" : "Own business"}
              </Badge>
            }
          >
            {visibleConnections.length ? (
              <div className="space-y-3">
                {visibleConnections.map((connection) => (
                  <div
                    key={connection.id}
                    className="grid gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4 lg:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-50">
                          {connection.name}
                        </h3>
                        <Badge>{connection.connectionId}</Badge>
                        <Badge>{stateLabels[connection.state]}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        {connection.phone ?? "Assigned after QR pairing"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {connection.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {updatedLabel(connection.updatedAt)}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        Bot: {getConnectionBotLabel(connection.id)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Schedule: {formatSchedule(connection.activeSchedule)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void refreshPairingQr(connection.id)}
                        className="min-h-11 rounded-lg border border-slate-700 px-3 text-sm text-slate-100 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        QR
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          connection.state === "inactive" ||
                          connection.state === "error"
                            ? void startPairing(connection.id)
                            : void patchConnection(connection.id, {
                                state: "inactive",
                              })
                        }
                        className="min-h-11 rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {connection.state === "inactive" ||
                        connection.state === "error"
                          ? "Start"
                          : "Stop"}
                      </button>
                      {connection.state === "connected" ||
                      connection.phone ||
                      pairingViews[connection.id]?.connected ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void unlinkPhone(connection.id)}
                          className="min-h-11 rounded-lg border border-slate-700 px-3 text-sm text-slate-100 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Unlink
                        </button>
                      ) : null}
                    </div>
                    <div className="border-t border-slate-800 pt-3 lg:col-span-2">
                      {!canUseSchedules ? (
                        <p className="mb-3 rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs leading-5 text-slate-400">
                          Schedules are available on paid accounts only. Trial
                          phones stay always active when the connection is
                          started.
                        </p>
                      ) : null}
                      <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto_auto] lg:items-end">
                        <div className="flex min-h-11 rounded-lg border border-slate-800 bg-slate-900 p-1">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void setConnectionAlwaysActive(connection.id)
                            }
                            className={cx(
                              "rounded-md px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
                              !connection.activeSchedule
                                ? "bg-slate-100 text-slate-950"
                                : "text-slate-300 hover:bg-slate-800",
                            )}
                          >
                            Always
                          </button>
                          <button
                            type="button"
                            disabled={saving || !canUseSchedules}
                            onClick={() =>
                              void updateConnectionSchedule(connection.id, {})
                            }
                            className={cx(
                              "rounded-md px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
                              connection.activeSchedule
                                ? "bg-slate-100 text-slate-950"
                                : "text-slate-300 hover:bg-slate-800",
                            )}
                          >
                            Schedule
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {weekdays.map((day) => {
                            const selected =
                              connection.activeSchedule?.days.includes(day) ??
                              false;

                            return (
                              <button
                                key={day}
                                type="button"
                                disabled={
                                  !connection.activeSchedule ||
                                  saving ||
                                  !canUseSchedules
                                }
                                onClick={() =>
                                  void toggleScheduleDay(connection.id, day)
                                }
                                className={cx(
                                  "min-h-9 rounded-lg border px-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40",
                                  selected
                                    ? "border-slate-400 bg-slate-100 text-slate-950"
                                    : "border-slate-700 text-slate-300 hover:bg-slate-800",
                                )}
                              >
                                {weekdayLabels[day]}
                              </button>
                            );
                          })}
                        </div>

                        <label className="space-y-1">
                          <span className="text-xs text-slate-500">From</span>
                          <input
                            type="time"
                            disabled={
                              !connection.activeSchedule ||
                              saving ||
                              !canUseSchedules
                            }
                            value={
                              connection.activeSchedule?.startTime ?? "09:00"
                            }
                            onChange={(event) =>
                              void updateConnectionSchedule(connection.id, {
                                startTime: event.target.value,
                              })
                            }
                            className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="text-xs text-slate-500">To</span>
                          <input
                            type="time"
                            disabled={
                              !connection.activeSchedule ||
                              saving ||
                              !canUseSchedules
                            }
                            value={
                              connection.activeSchedule?.endTime ?? "18:00"
                            }
                            onChange={(event) =>
                              void updateConnectionSchedule(connection.id, {
                                endTime: event.target.value,
                              })
                            }
                            className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </label>
                      </div>
                    </div>
                    {pairingViews[connection.id] ? (
                      <div className="border-t border-slate-800 pt-3 lg:col-span-2">
                        <QrPairingPanel
                          qrImage={pairingViews[connection.id]?.qrImage ?? null}
                          loading={
                            pairingViews[connection.id]?.loading ?? false
                          }
                          connected={
                            pairingViews[connection.id]?.connected ??
                            connection.state === "connected"
                          }
                          label={`QR code for ${connection.name}`}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No WhatsApp connections yet." />
            )}
          </Panel>

          <Panel title="Add Phone Connection">
            <form
              onSubmit={addConnection}
              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]"
            >
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Phone name
                </span>
                <input
                  value={phoneName}
                  onChange={(event) => setPhoneName(event.target.value)}
                  placeholder="Main store phone"
                  className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-50 outline-none placeholder:text-slate-600 focus:border-slate-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  Description
                </span>
                <input
                  value={phoneDescription}
                  onChange={(event) => setPhoneDescription(event.target.value)}
                  placeholder="Primary sales and customer support line"
                  className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-50 outline-none placeholder:text-slate-600 focus:border-slate-400"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">
                  WhatsApp number
                </span>
                <input
                  value="Assigned after QR pairing"
                  disabled
                  className="min-h-11 w-full cursor-not-allowed rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-500 outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={!selectedBusiness || !phoneName.trim() || saving}
                className="min-h-11 self-end rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add phone
              </button>
            </form>
          </Panel>
        </section>
      </div>
      {showSuspendedBlocker && selectedBusiness ? (
        <SuspendedAccountBlocker
          businessName={selectedBusiness.name}
          payHref={`/payment?businessId=${encodeURIComponent(selectedBusiness.id)}`}
        />
      ) : null}
    </main>
  );
}
