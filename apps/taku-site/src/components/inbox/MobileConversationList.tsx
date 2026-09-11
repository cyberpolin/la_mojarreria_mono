"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceSession } from "@/lib/taku-api";
import { createConversation, fetchConversations } from "./api";
import {
  conversationTitle,
  cx,
  digitsPhone,
  formatTime,
  isFullConversation,
  readConversationId,
  readMessageFromEvent,
  upsertConversation,
} from "./helpers";
import { MobileAuthGate, MobilePhoneFrame } from "./mobile-shell";
import { playIncomingSound, unlockIncomingSound } from "./playIncomingSound";
import type { InboxConversation } from "./types";
import { useInboxRealtime } from "./useInboxRealtime";

const POLL_INTERVAL_MS = 6000;

function listTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (sameDay) return formatTime(value);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return "Ayer";
  }
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function conversationHref(conversation: InboxConversation) {
  const phone = digitsPhone(conversation.contact?.phoneNumber ?? "");
  return phone ? `/conversation-mobile/${phone}` : "/conversation-mobile";
}

export function MobileConversationList() {
  const router = useRouter();
  const [needsAuth, setNeedsAuth] = useState(false);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadList = useCallback(async () => {
    if (!getWorkspaceSession()) {
      setNeedsAuth(true);
      setLoading(false);
      return;
    }
    setNeedsAuth(false);
    try {
      const rows = await fetchConversations({
        filter: "all",
        search: "",
        accountId: "all",
      });
      setConversations(rows);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar los chats.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((conversation) => {
      const haystack =
        `${conversation.contact?.name ?? ""} ${conversation.contact?.phoneNumber ?? ""} ${conversation.lastMessage?.body ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [conversations, query]);

  const handleMessageCreated = useCallback(
    (payload: unknown) => {
      const message = readMessageFromEvent(payload);
      if (message?.direction === "inbound") playIncomingSound();

      if (
        payload &&
        typeof payload === "object" &&
        "conversation" in payload &&
        isFullConversation((payload as { conversation: unknown }).conversation)
      ) {
        setConversations((current) =>
          upsertConversation(
            current,
            (payload as { conversation: InboxConversation }).conversation,
          ),
        );
        return;
      }

      const conversationId = readConversationId(payload);
      if (!message || !conversationId) return;
      setConversations((current) => {
        const existing = current.find((item) => item.id === conversationId);
        if (!existing) {
          void loadList();
          return current;
        }
        return upsertConversation(current, {
          ...existing,
          lastMessage: {
            body: message.body,
            direction: message.direction,
            createdAt: message.createdAt,
          },
          lastMessageAt: message.createdAt,
          unreadCount:
            message.direction === "inbound"
              ? existing.unreadCount + 1
              : existing.unreadCount,
        });
      });
    },
    [loadList],
  );

  const socketStatus = useInboxRealtime({
    enabled: !needsAuth,
    onMessageCreated: handleMessageCreated,
    onConversationUpdated: (payload) => {
      if (isFullConversation(payload)) {
        setConversations((current) => upsertConversation(current, payload));
      }
    },
    onReconnect: () => {
      void loadList();
    },
  });

  useEffect(() => {
    if (socketStatus !== "disconnected" || needsAuth) return;
    const intervalId = window.setInterval(() => {
      void loadList();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadList, needsAuth, socketStatus]);

  async function startConversation() {
    const phone = digitsPhone(newPhone);
    if (phone.length < 8) {
      setError("Ingresa un telefono valido.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const conversation = await createConversation({
        phoneNumber: phone,
        name: newName.trim() || undefined,
      });
      setComposerOpen(false);
      setNewPhone("");
      setNewName("");
      setConversations((current) => upsertConversation(current, conversation));
      router.push(`/conversation-mobile/${phone}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo iniciar el chat.",
      );
    } finally {
      setCreating(false);
    }
  }

  if (needsAuth) return <MobileAuthGate next="/conversation-mobile" />;

  return (
    <MobilePhoneFrame>
      <header className="bg-slate-900 px-4 pb-3 pt-4 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">WhatsApp</h1>
          <span className="text-[11px] text-slate-300">
            {socketStatus === "connected" ? "en linea" : "reconectando"}
          </span>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={unlockIncomingSound}
          placeholder="Buscar..."
          className="mt-3 min-h-10 w-full rounded-full bg-slate-800 px-4 text-sm text-white outline-none placeholder:text-slate-400"
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Cargando chats...</p>
        ) : null}
        {error ? <p className="p-4 text-sm text-slate-700">{error}</p> : null}
        {!loading && visible.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            {query.trim()
              ? "No hay chats para esa busqueda."
              : "No hay conversaciones."}
          </p>
        ) : null}
        {visible.map((conversation) => {
          const title = conversationTitle(conversation);
          const unread = conversation.unreadCount > 0;
          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => {
                unlockIncomingSound();
                router.push(conversationHref(conversation));
              }}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-300 text-base font-semibold text-slate-700">
                {title.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cx(
                      "truncate text-sm",
                      unread
                        ? "font-semibold text-slate-950"
                        : "font-medium text-slate-900",
                    )}
                  >
                    {title}
                  </p>
                  <span
                    className={cx(
                      "shrink-0 text-[11px]",
                      unread
                        ? "font-semibold text-slate-900"
                        : "text-slate-500",
                    )}
                  >
                    {listTime(conversation.lastMessageAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p
                    className={cx(
                      "min-w-0 flex-1 truncate text-[13px]",
                      unread ? "font-medium text-slate-800" : "text-slate-500",
                    )}
                  >
                    {conversation.lastMessage?.direction === "outbound"
                      ? "Tu: "
                      : conversation.lastMessage?.direction === "bot"
                        ? "Bot: "
                        : ""}
                    {conversation.lastMessage?.body ?? "Sin mensajes"}
                  </p>
                  {unread ? (
                    <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1.5 text-[11px] font-semibold text-white">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          unlockIncomingSound();
          setComposerOpen(true);
          setError(null);
        }}
        className="absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-2xl text-white shadow-lg"
        aria-label="Nuevo chat"
      >
        +
      </button>

      {composerOpen ? (
        <div className="absolute inset-0 z-10 flex flex-col bg-white">
          <header className="flex items-center gap-2 bg-slate-900 px-2 py-3 text-white">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center text-lg"
              onClick={() => setComposerOpen(false)}
              aria-label="Cerrar"
            >
              ←
            </button>
            <h2 className="text-base font-semibold">Nuevo chat</h2>
          </header>
          <form
            className="grid gap-3 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void startConversation();
            }}
          >
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Telefono
              <input
                autoFocus
                inputMode="tel"
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
                placeholder="5219931234567"
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Nombre (opcional)
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Juan Perez"
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            {error ? <p className="text-sm text-slate-700">{error}</p> : null}
            <button
              type="submit"
              disabled={creating}
              className="min-h-11 rounded-lg bg-slate-950 text-sm font-semibold text-white disabled:opacity-50"
            >
              {creating ? "Creando..." : "Iniciar chat"}
            </button>
          </form>
        </div>
      ) : null}
    </MobilePhoneFrame>
  );
}
