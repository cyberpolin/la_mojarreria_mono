"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceSession } from "@/lib/taku-api";
import {
  createAutomationBlock,
  createConversation,
  fetchBlockedContacts,
  fetchConversations,
  pinConversation,
  updateAutomationBlock,
} from "./api";
import {
  accountStatusLabel,
  conversationTitle,
  cx,
  digitsPhone,
  formatTime,
  isFullConversation,
  isGroupConversation,
  isVisibleInboxConversation,
  lastMessagePreview,
  mobileListPath,
  mobileThreadPath,
  readConversationId,
  readMessageFromEvent,
  sortConversationsUnreadFirst,
  upsertConversation,
} from "./helpers";
import {
  MobileAuthGate,
  MobileContextMenu,
  KebabIcon,
  longPressProps,
} from "./mobile-shell";
import {
  playIncomingSound,
  unlockIncomingSound,
  useArmIncomingSound,
} from "./playIncomingSound";
import type {
  InboxBlockedContact,
  InboxConversation,
  InboxWhatsAppAccount,
} from "./types";
import { useInboxRealtime } from "./useInboxRealtime";

const POLL_INTERVAL_MS = 6000;

function startOfLocalDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
}

function listTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const days = Math.round(
    (startOfLocalDay(new Date()) - startOfLocalDay(date)) / 86_400_000,
  );
  if (days <= 0) return formatTime(value);
  if (days === 1) return "Ayer";
  return `Hace ${days} dias`;
}

export function MobileConversationList({
  account = null,
  showAccountPicker = false,
  threadSlot = null,
}: {
  account?: InboxWhatsAppAccount | null;
  showAccountPicker?: boolean;
  threadSlot?: ReactNode;
}) {
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
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedContacts, setBlockedContacts] = useState<InboxBlockedContact[]>(
    [],
  );
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [rowMenu, setRowMenu] = useState<InboxConversation | null>(null);
  const didLongPressRef = useRef(false);
  useArmIncomingSound();

  const seenInboundRef = useRef<Map<string, string>>(new Map());
  const listReadyRef = useRef(false);

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
        accountId: account?.id ?? "all",
      });
      if (listReadyRef.current) {
        const heardNewInbound = rows.some((row) => {
          if (row.lastMessage?.direction !== "inbound") return false;
          const stamp = row.lastMessageAt ?? row.lastMessage.createdAt;
          const previous = seenInboundRef.current.get(row.id);
          return Boolean(stamp && previous && stamp !== previous);
        });
        if (heardNewInbound) playIncomingSound();
      }
      for (const row of rows) {
        const stamp = row.lastMessageAt ?? row.lastMessage?.createdAt;
        if (stamp) seenInboundRef.current.set(row.id, stamp);
      }
      listReadyRef.current = true;
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
  }, [account?.id]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const inboxVisible = conversations.filter(isVisibleInboxConversation);
    const filtered = needle
      ? inboxVisible.filter((conversation) => {
          const haystack =
            `${conversation.contact?.name ?? ""} ${conversation.contact?.phoneNumber ?? ""} ${conversation.lastMessage?.body ?? ""}`.toLowerCase();
          return haystack.includes(needle);
        })
      : inboxVisible;
    return sortConversationsUnreadFirst(filtered);
  }, [conversations, query]);

  const handleMessageCreated = useCallback(
    (payload: unknown) => {
      const message = readMessageFromEvent(payload);
      const incoming =
        payload &&
        typeof payload === "object" &&
        "conversation" in payload &&
        isFullConversation((payload as { conversation: unknown }).conversation)
          ? (payload as { conversation: InboxConversation }).conversation
          : null;
      if (account && incoming && incoming.whatsappAccount?.id !== account.id) {
        return;
      }
      if (incoming?.blocked) return;

      if (
        incoming &&
        message?.direction === "inbound" &&
        (!account || incoming.whatsappAccount?.id === account.id)
      ) {
        playIncomingSound();
      }

      if (incoming) {
        setConversations((current) => upsertConversation(current, incoming));
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
        if (message.direction === "inbound") playIncomingSound();
        return upsertConversation(current, {
          ...existing,
          lastMessage: {
            body: message.body,
            type: message.type,
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
    [account, loadList],
  );

  const socketStatus = useInboxRealtime({
    enabled: !needsAuth,
    onMessageCreated: handleMessageCreated,
    onConversationUpdated: (payload) => {
      if (!isFullConversation(payload)) return;
      if (account && payload.whatsappAccount?.id !== account.id) return;
      setConversations((current) => upsertConversation(current, payload));
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

  const searchedPhone = digitsPhone(query);

  async function startConversation(phoneOverride?: string) {
    const phone = digitsPhone(phoneOverride ?? newPhone);
    if (phone.length < 8) {
      setError("Ingresa un telefono valido.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const conversation = await createConversation({
        phoneNumber: phone,
        name: phoneOverride ? undefined : newName.trim() || undefined,
        whatsappAccountId: account?.id,
      });
      setComposerOpen(false);
      setNewPhone("");
      setNewName("");
      setQuery("");
      setConversations((current) => upsertConversation(current, conversation));
      router.push(mobileThreadPath(phone, showAccountPicker ? account : null));
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

  async function loadBlocked() {
    setBlockedLoading(true);
    try {
      const rows = await fetchBlockedContacts();
      setBlockedContacts(rows);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar los bloqueados.",
      );
    } finally {
      setBlockedLoading(false);
    }
  }

  async function togglePin(conversation: InboxConversation) {
    try {
      const result = await pinConversation(
        conversation.id,
        !conversation.pinned,
      );
      setConversations((current) => upsertConversation(current, result));
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo fijar el grupo.",
      );
    }
  }

  async function blockConversation(conversation: InboxConversation) {
    const phone = digitsPhone(conversation.contact?.phoneNumber ?? "");
    if (!phone) return;
    try {
      await createAutomationBlock({
        phoneNumber: phone,
        label: conversationTitle(conversation),
        enabled: true,
      });
      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo bloquear el telefono.",
      );
    }
  }

  async function unblockContact(contact: InboxBlockedContact) {
    try {
      await updateAutomationBlock(contact.id, false);
      setBlockedContacts((current) =>
        current.filter((item) => item.id !== contact.id),
      );
      void loadList();
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo desbloquear.",
      );
    }
  }

  function openConversation(conversation: InboxConversation) {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    unlockIncomingSound();
    router.push(
      mobileThreadPath(
        conversation.contact?.phoneNumber ?? "",
        showAccountPicker ? account : null,
      ),
    );
  }

  function handleHeaderBack() {
    if (threadSlot) {
      router.push(mobileListPath(showAccountPicker ? account : null));
      return;
    }
    if (showAccountPicker) router.push("/conversation-mobile");
  }

  if (needsAuth) {
    return (
      <MobileAuthGate
        next={mobileListPath(showAccountPicker ? account : null)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header
        id="taku-mobile-header"
        className="bg-slate-900 px-4 pb-3 pt-4 text-white"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {showAccountPicker || threadSlot ? (
              <button
                type="button"
                onClick={handleHeaderBack}
                className="grid h-10 w-8 shrink-0 place-items-center text-lg"
                aria-label="Volver"
              >
                ←
              </button>
            ) : null}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">
                {account && showAccountPicker
                  ? account.displayName
                  : "WhatsApp"}
              </h1>
              {account && showAccountPicker ? (
                <p className="truncate text-[11px] text-slate-300">
                  {account.phoneNumber ?? "Sin numero"}
                  {` · ${accountStatusLabel(account.status)}`}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-300">
              {socketStatus === "connected" ? "en linea" : "reconectando"}
            </span>
            <button
              type="button"
              onClick={() => setHeaderMenuOpen(true)}
              className="grid h-10 w-10 place-items-center text-white"
              aria-label="Mas opciones"
            >
              <KebabIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div
        id="taku-mobile-content"
        className="flex min-h-0 flex-1 flex-col bg-white"
      >
        <div
          className={cx(
            "relative flex min-h-0 flex-1 flex-col",
            threadSlot ? "hidden" : "flex",
          )}
        >
          <div className="bg-slate-900 px-4 pb-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={unlockIncomingSound}
              placeholder="Buscar..."
              className="min-h-10 w-full rounded-full bg-slate-800 px-4 text-sm text-white outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            {loading ? (
              <p className="p-4 text-sm text-slate-500">Cargando chats...</p>
            ) : null}
            {error ? (
              <p className="p-4 text-sm text-slate-700">{error}</p>
            ) : null}
            {!loading && visible.length === 0 && searchedPhone.length >= 8 ? (
              <button
                type="button"
                disabled={creating}
                onClick={() => {
                  unlockIncomingSound();
                  void startConversation(searchedPhone);
                }}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-60"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-900 text-lg font-semibold text-white">
                  +
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {searchedPhone}
                  </p>
                  <p className="mt-0.5 text-[13px] font-medium text-slate-600">
                    {creating ? "Creando chat..." : "Mensaje nuevo"}
                  </p>
                </div>
              </button>
            ) : null}
            {!loading && visible.length === 0 && searchedPhone.length < 8 ? (
              <p className="p-4 text-sm text-slate-500">
                {query.trim()
                  ? "No hay chats para esa busqueda."
                  : "No hay conversaciones."}
              </p>
            ) : null}
            {visible.map((conversation) => {
              const title = conversationTitle(conversation);
              const unread = conversation.unreadCount > 0;
              const press = longPressProps(() => {
                didLongPressRef.current = true;
                setRowMenu(conversation);
              });
              return (
                <div
                  key={conversation.id}
                  className="flex w-full items-stretch border-b border-slate-100 bg-white touch-manipulation"
                  style={press.style}
                  onContextMenu={press.onContextMenu}
                  onPointerDown={(event) => {
                    didLongPressRef.current = false;
                    press.onPointerDown(event);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openConversation(conversation)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
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
                          {conversation.pinned ? "📌 " : ""}
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
                            unread
                              ? "font-medium text-slate-800"
                              : "text-slate-500",
                          )}
                        >
                          {lastMessagePreview(conversation)}
                        </p>
                        {unread ? (
                          <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1.5 text-[11px] font-semibold text-white">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Opciones del chat"
                    onClick={(event) => {
                      event.stopPropagation();
                      didLongPressRef.current = true;
                      setRowMenu(conversation);
                    }}
                    className="grid w-12 shrink-0 place-items-center text-slate-500 hover:bg-slate-50"
                  >
                    <KebabIcon className="h-5 w-5" />
                  </button>
                </div>
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
        </div>
        {threadSlot ? (
          <div className="flex min-h-0 flex-1 flex-col">{threadSlot}</div>
        ) : null}
      </div>

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

      {headerMenuOpen ? (
        <MobileContextMenu
          items={[
            { label: "ejemplo", onSelect: () => undefined },
            {
              label: "ver bloqueados",
              onSelect: () => {
                setBlockedOpen(true);
                void loadBlocked();
              },
            },
          ]}
          onClose={() => setHeaderMenuOpen(false)}
        />
      ) : null}

      {rowMenu ? (
        <MobileContextMenu
          title={conversationTitle(rowMenu)}
          items={[
            { label: "ejemplo", onSelect: () => undefined },
            ...(isGroupConversation(rowMenu)
              ? [
                  {
                    label: rowMenu.pinned ? "Quitar pin" : "Fijar grupo",
                    onSelect: () => {
                      void togglePin(rowMenu);
                    },
                  },
                ]
              : [
                  {
                    label: "Bloquear",
                    danger: true,
                    onSelect: () => {
                      void blockConversation(rowMenu);
                    },
                  },
                ]),
          ]}
          onClose={() => {
            didLongPressRef.current = false;
            setRowMenu(null);
          }}
        />
      ) : null}

      {blockedOpen ? (
        <div className="absolute inset-0 z-40 flex flex-col bg-white">
          <header className="flex items-center gap-2 bg-slate-900 px-2 py-3 text-white">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center text-lg"
              onClick={() => setBlockedOpen(false)}
              aria-label="Cerrar"
            >
              ←
            </button>
            <h2 className="text-base font-semibold">Bloqueados</h2>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {blockedLoading ? (
              <p className="p-4 text-sm text-slate-500">Cargando...</p>
            ) : null}
            {error ? (
              <p className="p-4 text-sm text-slate-700">{error}</p>
            ) : null}
            {!blockedLoading && blockedContacts.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                No hay telefonos bloqueados.
              </p>
            ) : null}
            {blockedContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {contact.label || contact.phoneNumber}
                  </p>
                  <p className="truncate text-[13px] text-slate-500">
                    {contact.phoneNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void unblockContact(contact)}
                  className="min-h-10 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white"
                >
                  Desbloquear
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
