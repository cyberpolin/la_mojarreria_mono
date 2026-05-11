"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivePromoContact,
  ActivePromosResponse,
  isActivePromosResponse,
} from "@/lib/active-promos";

type ActivePromosClientProps = {
  contacts: ActivePromoContact[];
};

const WA_API_BASE_URL =
  process.env.NEXT_PUBLIC_MOJARRERIA_WA_API_BASE_URL ??
  "https://api.wa.lamojarreria.com";
const WA_API_KEY = process.env.NEXT_PUBLIC_MOJARRERIA_WA_API_KEY;
const WA_CLIENT_DOMAIN =
  process.env.NEXT_PUBLIC_MOJARRERIA_WA_CLIENT_DOMAIN ?? "lamojarreria.com";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const getPromoId = (contact: ActivePromoContact) =>
  `${contact.registration.campaignKey}:${contact.registration.phone}`;

export function ActivePromosClient({ contacts }: ActivePromosClientProps) {
  const [visibleContacts, setVisibleContacts] =
    useState<ActivePromoContact[]>(contacts);
  const [pendingPromoId, setPendingPromoId] = useState<string | null>(null);
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadPromos = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      const showLoading = options.showLoading ?? true;
      if (showLoading) {
        setLoadingPromos(true);
      }
      setLoadError(null);

      try {
        if (!WA_API_KEY) {
          throw new Error("NEXT_PUBLIC_MOJARRERIA_WA_API_KEY is required.");
        }

        const url = new URL(
          "/messages/inbound/recent-active-promos",
          WA_API_BASE_URL,
        );
        url.searchParams.set("limit", "50");

        const response = await fetch(url, {
          headers: {
            "x-api-key": WA_API_KEY,
            "x-client-domain": WA_CLIENT_DOMAIN,
          },
          cache: "no-store",
        });
        const payload: unknown = await response.json();

        if (!response.ok) {
          const message =
            typeof payload === "object" &&
            payload !== null &&
            "error" in payload &&
            typeof payload.error === "string"
              ? payload.error
              : `Promos request failed (${response.status})`;
          throw new Error(message);
        }

        if (!isActivePromosResponse(payload)) {
          throw new Error("Promos response did not match the expected shape.");
        }

        const data: ActivePromosResponse = payload;
        setVisibleContacts(data.contacts);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Failed to load promos",
        );
      } finally {
        if (showLoading) {
          setLoadingPromos(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadInitialPromos = async () => {
      if (!cancelled) {
        await loadPromos();
      }
    };

    void loadInitialPromos();

    return () => {
      cancelled = true;
    };
  }, [loadPromos]);

  const activeCount = visibleContacts.length;

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visibleContacts;

    return visibleContacts.filter((contact) => {
      const name = contact.registration.name.toLowerCase();
      return name.includes(query) || contact.phone.includes(query);
    });
  }, [search, visibleContacts]);

  const markAsUsed = async (contact: ActivePromoContact) => {
    const confirmed = window.confirm(
      `Mark promo for ${contact.registration.name} (${contact.phone}) as used?`,
    );

    if (!confirmed) {
      return;
    }

    const promoId = getPromoId(contact);
    setPendingPromoId(promoId);
    setLoadError(null);

    try {
      if (!WA_API_KEY) {
        throw new Error("NEXT_PUBLIC_MOJARRERIA_WA_API_KEY is required.");
      }

      const url = new URL(
        `/messages/registrations/${encodeURIComponent(contact.phone)}/use`,
        WA_API_BASE_URL,
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": WA_API_KEY,
          "x-client-domain": WA_CLIENT_DOMAIN,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to mark promotion as used.");
      }

      await loadPromos({ showLoading: false });
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to mark promotion as used.",
      );
    } finally {
      setPendingPromoId(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA PROMOS
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">
            Active Promotions
          </h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Recent WhatsApp contacts with active promo registrations. Used
            promotions are owned by the backend and disappear after refresh.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-right">
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Active
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-50">
              {activeCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Total
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-50">
              {visibleContacts.length}
            </p>
          </div>
        </div>
      </header>

      {loadError ? (
        <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
          {loadError}
        </section>
      ) : null}

      {loadingPromos ? (
        <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          Loading active promotions...
        </section>
      ) : null}

      <section className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          Search by name or phone
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="carlos or 5219931175435"
            className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 hover:border-slate-600 focus-visible:ring-2 focus-visible:ring-slate-500"
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Showing {filteredContacts.length} of {visibleContacts.length}
          {search.trim() ? " matching promotions." : " promotions."}
        </p>
      </section>

      {visibleContacts.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-sm font-medium text-slate-200">
            No active promotions
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Recent active promo contacts will appear here.
          </p>
        </section>
      ) : filteredContacts.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-sm font-medium text-slate-200">
            No matching promotions
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Try another name or phone number.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {filteredContacts.map((contact) => {
            const promoId = getPromoId(contact);
            const isPending = pendingPromoId === promoId;

            return (
              <article
                key={promoId}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm md:p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-50">
                        {contact.registration.name}
                      </h2>
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300">
                        {contact.registration.campaignKey}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200">
                        {contact.registration.status}
                      </span>
                    </div>

                    <dl className="grid gap-3 text-sm md:grid-cols-3">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Phone
                        </dt>
                        <dd className="mt-1 font-medium text-slate-100">
                          {contact.phone}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Messages
                        </dt>
                        <dd className="mt-1 text-slate-200">
                          {contact.messageCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Last received
                        </dt>
                        <dd className="mt-1 text-slate-200">
                          {formatDateTime(contact.lastReceivedAt)}
                        </dd>
                      </div>
                    </dl>

                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Last WhatsApp message
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">
                        {contact.lastText}
                      </p>
                      <p className="mt-2 break-all text-xs text-slate-500">
                        {contact.lastMessageId}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => markAsUsed(contact)}
                    className="h-11 shrink-0 rounded-lg border border-slate-700 bg-slate-100 px-4 text-sm font-medium text-slate-950 hover:bg-slate-50 active:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500"
                  >
                    {isPending ? "Marking..." : "Mark used"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
