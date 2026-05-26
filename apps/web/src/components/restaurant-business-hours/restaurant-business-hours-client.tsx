"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/ui/card";
import { BusinessHour, RestaurantRecord } from "@/lib/restaurant";

const CACHE_KEY = "MOJARRERIA_RESTAURANT_BUSINESS_HOURS_CACHE_V1";

const DEFAULT_HOURS: BusinessHour[] = [
  { day: "mon", label: "Monday", open: false, openTime: "", closeTime: "" },
  { day: "tue", label: "Tuesday", open: false, openTime: "", closeTime: "" },
  { day: "wed", label: "Wednesday", open: false, openTime: "", closeTime: "" },
  {
    day: "thu",
    label: "Thursday",
    open: true,
    openTime: "11:00",
    closeTime: "17:00",
  },
  {
    day: "fri",
    label: "Friday",
    open: true,
    openTime: "11:00",
    closeTime: "17:00",
  },
  {
    day: "sat",
    label: "Saturday",
    open: true,
    openTime: "11:00",
    closeTime: "17:00",
  },
  {
    day: "sun",
    label: "Sunday",
    open: true,
    openTime: "11:00",
    closeTime: "17:00",
  },
];

const normalizeHours = (value: unknown): BusinessHour[] => {
  const rows = Array.isArray(value) ? value : [];
  return DEFAULT_HOURS.map((fallback) => {
    const match = rows.find(
      (row) =>
        row &&
        typeof row === "object" &&
        String((row as Record<string, unknown>).day) === fallback.day,
    ) as Partial<BusinessHour> | undefined;

    return {
      day: fallback.day,
      label: fallback.label,
      open: Boolean(match?.open ?? fallback.open),
      openTime: String(match?.openTime ?? fallback.openTime),
      closeTime: String(match?.closeTime ?? fallback.closeTime),
    };
  });
};

export function RestaurantBusinessHoursClient() {
  const [restaurant, setRestaurant] = useState<RestaurantRecord | null>(null);
  const [hours, setHours] = useState<BusinessHour[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const openDays = useMemo(
    () => hours.filter((hour) => hour.open).length,
    [hours],
  );

  const loadRestaurant = async () => {
    setLoading(true);
    setError(null);

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const payload = JSON.parse(cached) as { restaurant: RestaurantRecord };
      setRestaurant(payload.restaurant);
      setHours(normalizeHours(payload.restaurant?.businessHours));
      setFromCache(true);
    }

    try {
      const response = await fetch("/api/restaurant", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Restaurant request failed (${response.status})`);
      }
      const payload = (await response.json()) as {
        restaurant: RestaurantRecord | null;
      };
      setRestaurant(payload.restaurant);
      setHours(normalizeHours(payload.restaurant?.businessHours));
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      setFromCache(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load restaurant hours",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRestaurant();
  }, []);

  const updateHour = (
    day: string,
    patch: Partial<Pick<BusinessHour, "open" | "openTime" | "closeTime">>,
  ) => {
    setHours((current) =>
      current.map((hour) => (hour.day === day ? { ...hour, ...patch } : hour)),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!restaurant?.name) {
        throw new Error("Create restaurant info before setting hours.");
      }

      const response = await fetch("/api/restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: restaurant.id,
          name: restaurant.name,
          description: restaurant.description ?? "",
          logo: restaurant.logo ?? null,
          businessHours: hours.map((hour) => ({
            ...hour,
            openTime: hour.open ? hour.openTime : "",
            closeTime: hour.open ? hour.closeTime : "",
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? `Save failed (${response.status})`);
      }

      const payload = (await response.json()) as {
        restaurant: RestaurantRecord;
      };
      setRestaurant(payload.restaurant);
      setHours(normalizeHours(payload.restaurant.businessHours));
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      setMessage("Business hours saved.");
      setFromCache(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save hours");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MOJARRERIA RESTAURANT
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">Business Hours</h1>
        <p className="mt-1 text-sm text-slate-400">
          Edit the public open hours for the restaurant.
        </p>
      </header>

      {error ? (
        <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          <p className="font-medium text-slate-100">Hours issue</p>
          <p>{error}</p>
          {fromCache ? (
            <p className="mt-1 text-slate-300">Showing cached hours.</p>
          ) : null}
        </section>
      ) : null}

      {message ? (
        <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100">
          {message}
        </section>
      ) : null}

      <AppCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {restaurant?.name ?? "Restaurant"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {openDays} open day{openDays === 1 ? "" : "s"} configured.
            </p>
          </div>
          {loading ? (
            <span className="text-xs text-slate-400">Loading...</span>
          ) : null}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {hours.map((hour) => (
            <div
              key={hour.day}
              className="grid gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4 md:grid-cols-[1fr_auto_auto]"
            >
              <label className="flex min-h-11 items-center gap-3 text-sm text-slate-100">
                <input
                  type="checkbox"
                  checked={hour.open}
                  onChange={(event) =>
                    updateHour(hour.day, { open: event.target.checked })
                  }
                  className="h-5 w-5 rounded border-slate-600 bg-slate-900"
                />
                <span className="font-medium">{hour.label}</span>
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Opens
                <input
                  type="time"
                  value={hour.openTime}
                  disabled={!hour.open}
                  onChange={(event) =>
                    updateHour(hour.day, { openTime: event.target.value })
                  }
                  className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 disabled:opacity-40"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Closes
                <input
                  type="time"
                  value={hour.closeTime}
                  disabled={!hour.open}
                  onChange={(event) =>
                    updateHour(hour.day, { closeTime: event.target.value })
                  }
                  className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 disabled:opacity-40"
                />
              </label>
            </div>
          ))}

          <button
            type="submit"
            disabled={saving || loading}
            className="h-11 w-full rounded-lg border border-slate-600 bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Business Hours"}
          </button>
        </form>
      </AppCard>
    </main>
  );
}
