"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearStoredSession,
  getSessionHeaders,
  getStoredSession,
  storeSession,
  type TakuSession,
} from "../session";

type Step = "business" | "phone" | "bot" | "pairing";
type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type Business = {
  id: string;
  name: string;
  ownerName: string;
  status: "active" | "trial" | "suspended";
  entitlements?: BusinessEntitlements;
};

type OnboardingStartResponse = {
  ok: true;
  business: Business;
  token: string;
  session: TakuSession;
};

type WaConnection = {
  id: string;
  businessId: string;
  connectionId: string;
  name: string;
};

type Bot = {
  id: string;
  businessId: string;
  name: string;
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

type PairingQrResponse = PairingResponse;

type ActiveSchedule = {
  days: Weekday[];
  startTime: string;
  endTime: string;
};

type BusinessEntitlements = {
  canUseSchedules: boolean;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_API_BASE_URL ?? "http://localhost:3010";
const apiKey = process.env.NEXT_PUBLIC_TAKU_API_KEY ?? "";
const clientBusinessId = "business_001";

const steps: Array<{ id: Step; label: string }> = [
  { id: "business", label: "Business" },
  { id: "phone", label: "Phone" },
  { id: "bot", label: "Bot" },
  { id: "pairing", label: "Pairing" },
];

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

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
      ...getSessionHeaders(),
      "x-taku-role": "client",
      "x-taku-business-id": clientBusinessId,
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
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

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-4">
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-50 outline-none placeholder:text-slate-600 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
        props.className,
      )}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none placeholder:text-slate-600 focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
        props.className,
      )}
    />
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
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-500 bg-slate-100 text-sm font-semibold text-slate-950">
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

function defaultSchedule(): ActiveSchedule {
  return {
    days: ["mon", "tue", "wed", "thu", "fri"],
    startTime: "09:00",
    endTime: "18:00",
  };
}

export default function OnboardingPage() {
  const setupStartedRef = useRef(false);
  const [step, setStep] = useState<Step>("business");
  const [business, setBusiness] = useState<Business | null>(null);
  const [session, setSession] = useState<TakuSession | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [phoneDescription, setPhoneDescription] = useState("");
  const [useSchedule, setUseSchedule] = useState(false);
  const [schedule, setSchedule] = useState<ActiveSchedule>(defaultSchedule);
  const [botName, setBotName] = useState("");
  const [botInstructions, setBotInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairingQrImage, setPairingQrImage] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingConnected, setPairingConnected] = useState(false);
  const [created, setCreated] = useState<{
    connection: WaConnection;
    bot: Bot;
  } | null>(null);

  const stepIndex = steps.findIndex((item) => item.id === step);
  const hasSession = Boolean(session);
  const canUseSchedules = business?.entitlements?.canUseSchedules ?? false;
  const canContinue = useMemo(() => {
    if (step === "business") {
      return hasSession
        ? Boolean(business)
        : Boolean(
            businessName.trim() &&
              ownerName.trim() &&
              ownerEmail.trim().includes("@"),
          );
    }
    if (step === "phone") return Boolean(phoneName.trim());
    if (step === "bot")
      return Boolean(botName.trim() && botInstructions.trim());
    return true;
  }, [
    botInstructions,
    botName,
    business,
    businessName,
    hasSession,
    ownerEmail,
    ownerName,
    phoneName,
    step,
  ]);

  useEffect(() => {
    const stored = getStoredSession();
    setSession(stored?.session ?? null);

    async function loadBusiness() {
      setLoading(true);
      setError(null);

      try {
        if (!stored) {
          setBusiness(null);
          return;
        }

        const body = await apiRequest<{ businesses: Business[] }>(
          "/v1/businesses",
        );
        setBusiness(body.businesses[0] ?? null);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to load business",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadBusiness();
  }, []);

  useEffect(() => {
    if (!created || pairingConnected) return;

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const body = await apiRequest<PairingStatusResponse>(
            `/v1/wa-connections/${created.connection.id}/pairing/status`,
          );

          setCreated((current) =>
            current ? { ...current, connection: body.waConnection } : current,
          );
          setPairingConnected(body.pairing.connected);

          if (body.pairing.hasQr && !pairingQrImage) {
            const qrBody = await apiRequest<PairingQrResponse>(
              `/v1/wa-connections/${created.connection.id}/pairing/qr`,
            );
            setPairingQrImage(qrBody.pairing.qrImage);
            setPairingConnected(qrBody.pairing.connection.connected);
          }

          setPairingLoading(false);
        } catch {
          setPairingLoading(false);
        }
      })();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [created, pairingConnected, pairingQrImage]);

  useEffect(() => {
    if (!pairingConnected) return;

    window.location.href = "/admin";
  }, [pairingConnected]);

  function toggleScheduleDay(day: Weekday) {
    setSchedule((current) => {
      const days = current.days.includes(day)
        ? current.days.filter((item) => item !== day)
        : [...current.days, day];

      return { ...current, days: days.length ? days : [day] };
    });
  }

  async function startOnboardingSession() {
    if (business || hasSession) return true;

    setSaving(true);
    setError(null);

    try {
      const body = await apiRequest<OnboardingStartResponse>(
        "/v1/session/onboarding-start",
        {
          method: "POST",
          body: JSON.stringify({
            businessName: businessName.trim(),
            ownerName: ownerName.trim(),
            email: ownerEmail.trim(),
          }),
        },
      );

      storeSession({ token: body.token, session: body.session });
      setSession(body.session);
      setBusiness(body.business);
      return true;
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to create onboarding user",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function nextStep() {
    if (step === "business") {
      const ready = await startOnboardingSession();
      if (!ready) return;
    }

    const next = steps[stepIndex + 1];
    if (next) setStep(next.id);
  }

  function previousStep() {
    const previous = steps[stepIndex - 1];
    if (previous) setStep(previous.id);
  }

  const createSetupAndStartPairing = useCallback(async () => {
    if (setupStartedRef.current || created) return;
    if (!business || !phoneName.trim() || !botName.trim()) return;

    setupStartedRef.current = true;
    setSaving(true);
    setPairingLoading(true);
    setError(null);

    try {
      const connectionBody = await apiRequest<{ waConnection: WaConnection }>(
        "/v1/wa-connections",
        {
          method: "POST",
          body: JSON.stringify({
            businessId: business.id,
            name: phoneName.trim(),
            description: phoneDescription.trim(),
            activeSchedule: useSchedule && canUseSchedules ? schedule : null,
          }),
        },
      );

      const botBody = await apiRequest<{ bot: Bot }>("/v1/bots", {
        method: "POST",
        body: JSON.stringify({
          businessId: business.id,
          name: botName.trim(),
          instructions: botInstructions.trim(),
          status: "active",
          fallbackMessage:
            "Thanks for writing. A team member will follow up shortly.",
        }),
      });

      await apiRequest("/v1/bot-assignments", {
        method: "POST",
        body: JSON.stringify({
          businessId: business.id,
          botId: botBody.bot.id,
          waConnectionId: connectionBody.waConnection.id,
          active: true,
        }),
      });

      const pairingBody = await apiRequest<PairingResponse>(
        `/v1/wa-connections/${connectionBody.waConnection.id}/pairing/start`,
        { method: "POST" },
      );

      setCreated({
        connection: pairingBody.waConnection,
        bot: botBody.bot,
      });
      setPairingQrImage(pairingBody.pairing.qrImage);
      setPairingConnected(pairingBody.pairing.connection.connected);
      setPairingLoading(false);
    } catch (nextError) {
      setupStartedRef.current = false;
      setPairingLoading(false);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to complete onboarding",
      );
    } finally {
      setSaving(false);
    }
  }, [
    botInstructions,
    botName,
    business,
    created,
    phoneDescription,
    phoneName,
    schedule,
    canUseSchedules,
    useSchedule,
  ]);

  useEffect(() => {
    if (step !== "pairing") return;

    void createSetupAndStartPairing();
  }, [createSetupAndStartPairing, step]);

  return (
    <main className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              TAKU Onboarding
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">
              Set up your first WhatsApp bot
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/login"
              className="flex min-h-10 items-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            >
              {session ? session.name : "Sign in"}
            </Link>
            {session ? (
              <button
                type="button"
                onClick={() => {
                  clearStoredSession();
                  window.location.href = "/login";
                }}
                className="min-h-10 rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              >
                Sign out
              </button>
            ) : null}
            <Link
              href="/admin"
              className="flex min-h-10 items-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            >
              Admin
            </Link>
            <Link
              href="/docs"
              className="flex min-h-10 items-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            >
              Docs
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 md:grid-cols-[240px_1fr] md:px-6">
        <aside className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="space-y-2">
            {steps.map((item, index) => (
              <button
                key={item.id}
                type="button"
                disabled={index > stepIndex && !created}
                onClick={() => setStep(item.id)}
                className={cx(
                  "flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-40",
                  item.id === step
                    ? "border-slate-500 bg-slate-800 text-slate-50"
                    : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700",
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 text-xs">
                  {index + 1}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100">
              {error}
            </div>
          ) : null}

          {step === "pairing" ? (
            <Card title="Pair WhatsApp">
              <div className="space-y-4">
                <p className="text-sm leading-6 text-slate-300">
                  TAKU creates the phone record, active starter bot, and bot
                  assignment here, then requests a QR from WA Service. Scan the
                  QR with WhatsApp to finish onboarding.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Business
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-50">
                      {business?.name ?? "No business"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Phone
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-50">
                      {created?.connection.name ?? phoneName}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {useSchedule ? "Scheduled" : "Always active"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Bot
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-50">
                      {created?.bot.name ?? botName}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Created as active
                    </p>
                  </div>
                </div>

                {!created && saving ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                    Creating setup and requesting the pairing QR...
                  </div>
                ) : null}

                {created && pairingQrImage ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <p className="mb-3 text-sm font-medium text-slate-100">
                      {pairingConnected
                        ? "WhatsApp is connected. Opening admin..."
                        : "Scan this QR code with WhatsApp."}
                    </p>
                    <QrPairingPanel
                      qrImage={pairingQrImage}
                      loading={pairingLoading}
                      connected={pairingConnected}
                      label={`QR code for ${created.connection.name}`}
                    />
                  </div>
                ) : null}

                {created && !pairingQrImage ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                    Pairing started, but WA Service has not returned a QR code
                    yet. The status check will continue while this page is open.
                  </div>
                ) : null}

                {!created && !saving ? (
                  <button
                    type="button"
                    onClick={() => void createSetupAndStartPairing()}
                    className="min-h-11 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                  >
                    Retry pairing setup
                  </button>
                ) : null}
              </div>
            </Card>
          ) : null}

          {step === "business" ? (
            <Card
              title={hasSession ? "Business Context" : "Create Your Account"}
            >
              {loading ? (
                <p className="text-sm text-slate-400">Loading business...</p>
              ) : business ? (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-slate-300">
                    The current client-user session is scoped to this business.
                  </p>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <p className="text-lg font-semibold text-slate-50">
                      {business.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Owner: {business.ownerName}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Status: {business.status}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-slate-300">
                    Create the business owner account first. TAKU will start a
                    session and continue with phone and bot setup.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Business name">
                      <TextInput
                        value={businessName}
                        onChange={(event) =>
                          setBusinessName(event.target.value)
                        }
                        placeholder="Mariscos Costa"
                      />
                    </Field>
                    <Field label="Owner name">
                      <TextInput
                        value={ownerName}
                        onChange={(event) => setOwnerName(event.target.value)}
                        placeholder="Ana Lopez"
                      />
                    </Field>
                  </div>
                  <Field label="Owner email">
                    <TextInput
                      type="email"
                      value={ownerEmail}
                      onChange={(event) => setOwnerEmail(event.target.value)}
                      placeholder="owner@example.com"
                    />
                  </Field>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-400">
                    The development password for this new client user is the
                    configured `TAKU_CLIENT_PASSWORD`.
                  </div>
                </div>
              )}
            </Card>
          ) : null}

          {step === "phone" ? (
            <Card title="Phone Connection">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Phone name">
                    <TextInput
                      value={phoneName}
                      onChange={(event) => setPhoneName(event.target.value)}
                      placeholder="Main WhatsApp"
                    />
                  </Field>
                  <Field label="WhatsApp number">
                    <TextInput value="Assigned after QR pairing" disabled />
                  </Field>
                </div>
                <Field label="Description">
                  <TextInput
                    value={phoneDescription}
                    onChange={(event) =>
                      setPhoneDescription(event.target.value)
                    }
                    placeholder="Primary customer service and sales line"
                  />
                </Field>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <label className="flex min-h-11 items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium text-slate-100">
                        Active schedule
                      </span>
                      <span className="block text-xs text-slate-500">
                        {canUseSchedules
                          ? "Leave off for always active."
                          : "Schedules are available on paid accounts only."}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={useSchedule && canUseSchedules}
                      disabled={!canUseSchedules}
                      onChange={(event) => setUseSchedule(event.target.checked)}
                      className="h-5 w-5 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                  {useSchedule && canUseSchedules ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
                      <div className="flex flex-wrap gap-1">
                        {weekdays.map((day) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleScheduleDay(day)}
                            className={cx(
                              "min-h-9 rounded-lg border px-2 text-xs font-medium",
                              schedule.days.includes(day)
                                ? "border-slate-400 bg-slate-100 text-slate-950"
                                : "border-slate-700 text-slate-300 hover:bg-slate-800",
                            )}
                          >
                            {weekdayLabels[day]}
                          </button>
                        ))}
                      </div>
                      <Field label="From">
                        <TextInput
                          type="time"
                          value={schedule.startTime}
                          onChange={(event) =>
                            setSchedule((current) => ({
                              ...current,
                              startTime: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="To">
                        <TextInput
                          type="time"
                          value={schedule.endTime}
                          onChange={(event) =>
                            setSchedule((current) => ({
                              ...current,
                              endTime: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}

          {step === "bot" ? (
            <Card title="Starter Bot">
              <div className="space-y-4">
                <Field label="Bot name">
                  <TextInput
                    value={botName}
                    onChange={(event) => setBotName(event.target.value)}
                    placeholder="Customer assistant"
                  />
                </Field>
                <Field label="Instructions">
                  <TextArea
                    rows={6}
                    value={botInstructions}
                    onChange={(event) => setBotInstructions(event.target.value)}
                    placeholder="Describe what this bot should handle."
                  />
                </Field>
              </div>
            </Card>
          ) : null}

          {step !== "pairing" ? (
            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                disabled={stepIndex === 0 || saving}
                onClick={previousStep}
                className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canContinue || saving}
                onClick={() => void nextStep()}
                className="min-h-11 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
