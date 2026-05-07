"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type OwnerStatus = {
  required: boolean;
  owners: Array<{ id: string; name: string; email: string }>;
};

type OwnerDraft = {
  name: string;
  phone: string;
  email: string;
  password: string;
  pin: string;
  address: string;
};

const defaultDraft: OwnerDraft = {
  name: "",
  phone: "",
  email: "",
  password: "",
  pin: "",
  address: "",
};

export default function OwnerOnboardingPage() {
  const [status, setStatus] = useState<OwnerStatus | null>(null);
  const [draft, setDraft] = useState<OwnerDraft>(defaultDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [createdOwner, setCreatedOwner] = useState<
    OwnerStatus["owners"][0] | null
  >(null);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      try {
        const response = await fetch("/api/admin/owner-onboarding", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Failed to load owner status.");
        const payload = (await response.json()) as OwnerStatus;
        if (active) setStatus(payload);
      } catch (error) {
        if (active)
          setErrors([
            error instanceof Error ? error.message : "Failed to load status.",
          ]);
      }
    };
    loadStatus();
    return () => {
      active = false;
    };
  }, []);

  const updateDraft = (field: keyof OwnerDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const saveOwner = async () => {
    const missing: string[] = [];
    if (!draft.name.trim()) missing.push("Owner name is required.");
    if (!draft.phone.trim()) missing.push("Phone is required.");
    if (!draft.email.trim()) missing.push("Email is required.");
    if (!draft.password.trim()) missing.push("Password is required.");
    if (!draft.pin.trim() || draft.pin.trim().length !== 4)
      missing.push("4-digit PIN is required.");

    if (missing.length > 0) {
      setErrors(missing);
      return;
    }

    setErrors([]);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/owner-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as {
        owner?: OwnerStatus["owners"][0];
        error?: string;
      };
      if (!response.ok || !payload.owner) {
        throw new Error(payload.error ?? "Failed to create owner.");
      }
      setCreatedOwner(payload.owner);
      setStatus({ required: false, owners: [payload.owner] });
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Failed to create owner.",
      ]);
    } finally {
      setSaving(false);
    }
  };

  if (!status && errors.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Admin onboarding
          </p>
          <h1 className="text-2xl font-semibold">Loading owner status...</h1>
        </div>
      </main>
    );
  }

  if (status && !status.required) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Admin onboarding
          </p>
          <h1 className="text-2xl font-semibold">Owner already created</h1>
          <p className="text-sm text-slate-300">
            The first owner account already exists. You can manage team access
            from Team Control.
          </p>
          {createdOwner && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-200">
              Created owner: {createdOwner.name} ({createdOwner.email})
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/team-control"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
            >
              Open Team Control
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Admin onboarding
          </p>
          <h1 className="text-2xl font-semibold">Create the first owner</h1>
          <p className="text-sm text-slate-300">
            This owner account will manage the restaurant. Share these
            credentials securely.
          </p>
          <Link
            href="/logout"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-800 px-4 text-xs uppercase tracking-[0.2em] text-slate-300 hover:border-slate-600 hover:text-slate-100"
          >
            Logout
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/40">
          <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <label className="grid gap-2 text-sm text-slate-200">
              Owner name
              <input
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                placeholder="Owner name"
                className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
              />
            </label>
            <label className="grid gap-2 text-sm text-slate-200">
              Phone
              <input
                value={draft.phone}
                onChange={(event) => updateDraft("phone", event.target.value)}
                placeholder="521999999999"
                className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
              />
            </label>
            <label className="grid gap-2 text-sm text-slate-200">
              Email
              <input
                value={draft.email}
                onChange={(event) => updateDraft("email", event.target.value)}
                placeholder="owner@email.com"
                className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
              />
            </label>
            <label className="grid gap-2 text-sm text-slate-200">
              Password
              <input
                type="password"
                value={draft.password}
                onChange={(event) =>
                  updateDraft("password", event.target.value)
                }
                placeholder="••••••••"
                className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
              />
            </label>
            <label className="grid gap-2 text-sm text-slate-200">
              4-digit PIN
              <input
                value={draft.pin}
                onChange={(event) => updateDraft("pin", event.target.value)}
                placeholder="1234"
                className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
              />
              <span className="text-xs text-slate-400">
                Used for quick access and shift control.
              </span>
            </label>
            <label className="grid gap-2 text-sm text-slate-200">
              Address (optional)
              <input
                value={draft.address}
                onChange={(event) => updateDraft("address", event.target.value)}
                placeholder="Street, city"
                className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
              />
            </label>
          </div>

          {errors.length > 0 && (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={saveOwner}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Creating..." : "Create owner"}
            </button>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
            >
              Back to dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
