"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWorkspaceSession } from "@/lib/taku-api";
import {
  createAutomationBlock,
  fetchConversation,
  fetchConversations,
  fetchNewestMessages,
  markConversationRead,
  sendConversationMessage,
  updateAutomationBlock,
  updateContact,
  updateConversationAssignment,
  updateConversationStatus,
} from "./api";
import { ConversationList } from "./ConversationList";
import { ConversationRail } from "./ConversationRail";
import { ConversationThread } from "./ConversationThread";
import {
  digitsPhone,
  isAccountConnected,
  isFullConversation,
  mergeConversationPatch,
  readConversationId,
  readMessageFromEvent,
  upsertConversation,
  upsertMessage,
  withLiveAccount,
} from "./helpers";
import type {
  ConversationFilterId,
  InboxBlockedContact,
  InboxConversation,
  InboxMessage,
  InboxUser,
  InboxWhatsAppAccount,
} from "./types";
import { useInboxRealtime } from "./useInboxRealtime";

const SEARCH_DEBOUNCE_MS = 300;
const POLL_INTERVAL_MS = 6000;

export function ConversationsInbox({
  accounts,
  users,
  blockedContacts,
  conversationId,
  onSelectConversation,
  onRefreshWorkspace,
}: {
  accounts: InboxWhatsAppAccount[];
  users: InboxUser[];
  blockedContacts: InboxBlockedContact[];
  conversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onRefreshWorkspace: () => void;
}) {
  const [filter, setFilter] = useState<ConversationFilterId>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("all");
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<InboxConversation | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingAutomationBlock, setIsSavingAutomationBlock] = useState(false);
  const [railError, setRailError] = useState<string | null>(null);
  const [localBlocked, setLocalBlocked] =
    useState<InboxBlockedContact[]>(blockedContacts);

  const selectedIdRef = useRef(conversationId);
  const queryRef = useRef({ filter, search, accountId });
  const accountsRef = useRef(accounts);
  const currentUserId = getWorkspaceSession()?.user.id ?? null;
  const reloadMessagesRef = useRef<
    (id: string, silent?: boolean) => Promise<void>
  >(async () => undefined);
  selectedIdRef.current = conversationId;
  queryRef.current = { filter, search, accountId };
  accountsRef.current = accounts;

  const selected = useMemo(() => {
    const fromList = conversations.find((item) => item.id === conversationId);
    const raw =
      fromList ??
      (selectedDetail?.id === conversationId ? selectedDetail : null);
    return raw ? withLiveAccount(raw, accounts) : null;
  }, [accounts, conversationId, conversations, selectedDetail]);

  const visibleConversations = useMemo(
    () => conversations.map((item) => withLiveAccount(item, accounts)),
    [accounts, conversations],
  );

  const selectedBlocked = useMemo(() => {
    const phone = selected?.contact?.phoneNumber ?? "";
    return (
      localBlocked.find(
        (item) => digitsPhone(item.phoneNumber) === digitsPhone(phone),
      ) ?? null
    );
  }, [localBlocked, selected?.contact?.phoneNumber]);

  const matchesQuery = useCallback(
    (conversation: InboxConversation) => {
      const query = queryRef.current;
      if (
        query.accountId !== "all" &&
        conversation.whatsappAccount?.id !== query.accountId
      ) {
        return false;
      }
      if (query.filter === "open" && conversation.status !== "open")
        return false;
      if (query.filter === "closed" && conversation.status !== "closed")
        return false;
      if (query.filter === "archived" && conversation.status !== "archived")
        return false;
      if (query.filter === "unread" && conversation.unreadCount <= 0)
        return false;
      if (query.filter === "unassigned" && conversation.assignedUser)
        return false;
      if (
        query.filter === "mine" &&
        conversation.assignedUser?.id !== currentUserId
      ) {
        return false;
      }
      if (query.search.trim()) {
        const haystack =
          `${conversation.contact?.name ?? ""} ${conversation.contact?.phoneNumber ?? ""} ${conversation.lastMessage?.body ?? ""}`.toLowerCase();
        if (!haystack.includes(query.search.trim().toLowerCase())) return false;
      }
      return true;
    },
    [currentUserId],
  );

  const applyConversation = useCallback(
    (incoming: InboxConversation) => {
      const live = withLiveAccount(incoming, accountsRef.current);
      if (live.id === selectedIdRef.current) setSelectedDetail(live);
      setConversations((current) => {
        if (!matchesQuery(live) && live.id !== selectedIdRef.current) {
          return current.filter((item) => item.id !== live.id);
        }
        return upsertConversation(current, live);
      });
    },
    [matchesQuery],
  );

  const applyConversationPatch = useCallback(
    (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const record = payload as Record<string, unknown>;
      if (isFullConversation(payload)) {
        applyConversation(payload);
        return;
      }
      const id = typeof record.id === "string" ? record.id : null;
      if (!id) return;
      setConversations((current) => {
        const existing = current.find((item) => item.id === id);
        if (!existing) return current;
        const merged = mergeConversationPatch(existing, {
          status: typeof record.status === "string" ? record.status : undefined,
          unreadCount:
            typeof record.unreadCount === "number"
              ? record.unreadCount
              : undefined,
          assignedUser:
            "assignedUser" in record
              ? ((record.assignedUser as InboxConversation["assignedUser"]) ??
                null)
              : undefined,
          updatedAt:
            typeof record.updatedAt === "string" ? record.updatedAt : undefined,
        });
        if (!matchesQuery(merged) && merged.id !== selectedIdRef.current) {
          return current.filter((item) => item.id !== id);
        }
        return upsertConversation(current, merged);
      });
      if (id === selectedIdRef.current && typeof record.status === "string") {
        void reloadMessagesRef.current(id, true);
      }
    },
    [applyConversation, matchesQuery],
  );

  const loadConversations = useCallback(async (showLoading = false) => {
    if (showLoading) setListLoading(true);
    setListError(null);
    try {
      const rows = await fetchConversations(queryRef.current);
      setConversations(rows);
    } catch (caught) {
      setListError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar las conversaciones.",
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  const reloadMessages = useCallback(async (id: string, silent = false) => {
    if (!silent) setThreadLoading(true);
    try {
      const result = await fetchNewestMessages(id);
      if (selectedIdRef.current !== id) return;
      setMessages((current) => {
        const optimistic = current.filter((item) =>
          item.id.startsWith("optimistic:"),
        );
        let next = result.items;
        for (const item of optimistic) {
          const replaced = next.some(
            (message) =>
              message.direction === "outbound" && message.body === item.body,
          );
          if (!replaced) next = [...next, item];
        }
        return next;
      });
      setHasMoreMessages(result.hasMore);
      setThreadError(null);
    } catch (caught) {
      if (selectedIdRef.current === id) {
        setThreadError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cargar los mensajes.",
        );
      }
    } finally {
      if (selectedIdRef.current === id) setThreadLoading(false);
    }
  }, []);
  reloadMessagesRef.current = reloadMessages;

  const handleMessageCreated = useCallback(
    (payload: unknown) => {
      const message = readMessageFromEvent(payload);
      const conversationIdFromEvent =
        readConversationId(payload) ??
        (payload &&
        typeof payload === "object" &&
        "conversation" in payload &&
        isFullConversation((payload as { conversation: unknown }).conversation)
          ? (payload as { conversation: InboxConversation }).conversation.id
          : null);
      if (!message || !conversationIdFromEvent) return;

      if (conversationIdFromEvent === selectedIdRef.current) {
        setMessages((current) => upsertMessage(current, message));
        if (message.direction === "inbound") {
          void markConversationRead(conversationIdFromEvent).catch(
            () => undefined,
          );
        }
      }

      if (
        payload &&
        typeof payload === "object" &&
        "conversation" in payload &&
        isFullConversation((payload as { conversation: unknown }).conversation)
      ) {
        const incoming = (payload as { conversation: InboxConversation })
          .conversation;
        applyConversation({
          ...incoming,
          unreadCount:
            conversationIdFromEvent === selectedIdRef.current
              ? 0
              : incoming.unreadCount,
        });
        return;
      }

      setConversations((current) => {
        const existing = current.find(
          (item) => item.id === conversationIdFromEvent,
        );
        if (!existing) return current;
        const unreadCount =
          conversationIdFromEvent === selectedIdRef.current
            ? 0
            : message.direction === "inbound"
              ? existing.unreadCount + 1
              : existing.unreadCount;
        return upsertConversation(current, {
          ...existing,
          lastMessage: {
            body: message.body,
            direction: message.direction,
            createdAt: message.createdAt,
          },
          lastMessageAt: message.createdAt,
          unreadCount,
        });
      });
    },
    [applyConversation],
  );

  const socketStatus = useInboxRealtime({
    enabled: true,
    onMessageCreated: handleMessageCreated,
    onConversationUpdated: applyConversationPatch,
    onReconnect: () => {
      void loadConversations();
      if (selectedIdRef.current)
        void reloadMessages(selectedIdRef.current, true);
    },
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setSearch(searchInput),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    void loadConversations(true);
  }, [accountId, filter, loadConversations, search]);

  useEffect(() => {
    setLocalBlocked(blockedContacts);
  }, [blockedContacts]);

  useEffect(() => {
    if (socketStatus !== "disconnected") return;
    const intervalId = window.setInterval(() => {
      void loadConversations();
      if (selectedIdRef.current)
        void reloadMessages(selectedIdRef.current, true);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadConversations, reloadMessages, socketStatus]);

  useEffect(() => {
    setDraft("");
    setThreadError(null);
    setRailError(null);
    if (!conversationId) {
      setSelectedDetail(null);
      setMessages([]);
      setHasMoreMessages(false);
      setContactName("");
      setContactNotes("");
      return;
    }

    let cancelled = false;
    async function openConversation(id: string) {
      setThreadLoading(true);
      try {
        const detail = await fetchConversation(id);
        if (cancelled) return;
        setSelectedDetail(detail);
        applyConversation({ ...detail, unreadCount: 0 });
        await markConversationRead(id).catch(() => undefined);
        await reloadMessages(id);
      } catch (caught) {
        if (!cancelled) {
          setThreadError(
            caught instanceof Error
              ? caught.message
              : "No se pudo abrir la conversacion.",
          );
        }
      }
    }
    void openConversation(conversationId);
    return () => {
      cancelled = true;
    };
  }, [applyConversation, conversationId, reloadMessages]);

  useEffect(() => {
    setContactName(selected?.contact?.name ?? "");
    setContactNotes(selected?.contact?.notes ?? "");
  }, [
    selected?.contact?.id,
    selected?.contact?.name,
    selected?.contact?.notes,
  ]);

  async function handleSend() {
    if (
      !selected ||
      !draft.trim() ||
      !isAccountConnected(selected.whatsappAccount?.status)
    ) {
      return;
    }
    const body = draft.trim();
    const targetId = selected.id;
    const clientKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());
    const optimistic: InboxMessage = {
      id: `optimistic:${clientKey}`,
      clientKey,
      direction: "outbound",
      type: "text",
      body,
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    setDraft("");
    setIsSending(true);
    setThreadError(null);
    if (selectedIdRef.current === targetId) {
      setMessages((current) => upsertMessage(current, optimistic));
    }
    setConversations((current) => {
      const existing = current.find((item) => item.id === targetId);
      if (!existing) return current;
      return upsertConversation(current, {
        ...existing,
        lastMessage: {
          body,
          direction: "outbound",
          createdAt: optimistic.createdAt,
        },
        lastMessageAt: optimistic.createdAt,
      });
    });

    try {
      const persisted = await sendConversationMessage(targetId, body);
      if (selectedIdRef.current === targetId) {
        setMessages((current) => {
          const withoutOptimistic = current.filter(
            (item) => item.clientKey !== clientKey && item.id !== optimistic.id,
          );
          return upsertMessage(withoutOptimistic, persisted);
        });
      }
    } catch (caught) {
      if (selectedIdRef.current === targetId) {
        setMessages((current) =>
          current.map((item) =>
            item.clientKey === clientKey || item.id === optimistic.id
              ? { ...item, status: "failed" }
              : item,
          ),
        );
        setThreadError(
          caught instanceof Error
            ? caught.message
            : "No se pudo enviar el mensaje.",
        );
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleLoadOlder() {
    if (!selected || olderLoading) return;
    const oldest = messages[0];
    if (!oldest) return;
    setOlderLoading(true);
    try {
      const result = await fetchNewestMessages(selected.id, oldest.createdAt);
      setMessages((current) => {
        const known = new Set(current.map((item) => item.id));
        return [
          ...result.items.filter((item) => !known.has(item.id)),
          ...current,
        ];
      });
      setHasMoreMessages(result.hasMore);
    } catch (caught) {
      setThreadError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar mensajes anteriores.",
      );
    } finally {
      setOlderLoading(false);
    }
  }

  async function handleSaveContact() {
    if (!selected?.contact) return;
    setIsSavingContact(true);
    setRailError(null);
    try {
      const contact = await updateContact(selected.contact.id, {
        name: contactName.trim(),
        notes: contactNotes,
      });
      if (contact) {
        applyConversation({
          ...selected,
          contact: {
            ...selected.contact,
            ...contact,
          },
        });
      }
      onRefreshWorkspace();
    } catch (caught) {
      setRailError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el contacto.",
      );
    } finally {
      setIsSavingContact(false);
    }
  }

  async function handleAssign(userId: string | null) {
    if (!selected) return;
    setIsSavingAssignment(true);
    setRailError(null);
    try {
      const result = await updateConversationAssignment(selected.id, userId);
      applyConversationPatch(result);
    } catch (caught) {
      setRailError(
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar la asignacion.",
      );
    } finally {
      setIsSavingAssignment(false);
    }
  }

  async function handleStatus(status: "open" | "closed" | "archived") {
    if (!selected) return;
    setIsSavingStatus(true);
    setRailError(null);
    try {
      const result = await updateConversationStatus(selected.id, status);
      applyConversationPatch(result);
      await reloadMessages(selected.id, true);
    } catch (caught) {
      setRailError(
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar el estado.",
      );
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function handleToggleAutomation(enabled: boolean) {
    if (!selected?.contact?.phoneNumber) return;
    setIsSavingAutomationBlock(true);
    setRailError(null);
    try {
      const result = selectedBlocked
        ? await updateAutomationBlock(selectedBlocked.id, enabled)
        : await createAutomationBlock({
            phoneNumber: selected.contact.phoneNumber,
            label: selected.contact.name ?? contactName.trim(),
            enabled,
          });
      setLocalBlocked((current) => {
        const exists = current.some((item) => item.id === result.id);
        return exists
          ? current.map((item) => (item.id === result.id ? result : item))
          : [...current, result];
      });
      onRefreshWorkspace();
    } catch (caught) {
      setRailError(
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar la automatizacion del contacto.",
      );
    } finally {
      setIsSavingAutomationBlock(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Conversaciones
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Bandeja compartida de WhatsApp
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Atiende, asigna y responde desde el navegador. El backend es la
            fuente de verdad.
          </p>
        </div>
        {socketStatus === "disconnected" ? (
          <p className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
            Tiempo real desconectado. Actualizando cada 6 segundos.
          </p>
        ) : null}
      </div>

      <div className="grid min-h-[680px] gap-4 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
        <ConversationList
          conversations={visibleConversations}
          accounts={accounts}
          selectedId={conversationId}
          filter={filter}
          search={searchInput}
          accountId={accountId}
          isLoading={listLoading}
          error={listError}
          onFilterChange={setFilter}
          onSearchChange={setSearchInput}
          onAccountChange={setAccountId}
          onSelect={onSelectConversation}
        />
        <ConversationThread
          conversation={selected}
          messages={messages}
          draft={draft}
          isLoading={
            Boolean(conversationId) && threadLoading && messages.length === 0
          }
          isLoadingOlder={olderLoading}
          hasMore={hasMoreMessages}
          isSending={isSending}
          canSend={
            Boolean(selected) &&
            isAccountConnected(selected?.whatsappAccount?.status)
          }
          error={threadError}
          onDraftChange={setDraft}
          onSend={() => void handleSend()}
          onLoadOlder={() => void handleLoadOlder()}
        />
        <div className="hidden xl:block">
          <ConversationRail
            conversation={selected}
            users={users}
            blockedContact={selectedBlocked}
            contactName={contactName}
            contactNotes={contactNotes}
            isSavingContact={isSavingContact}
            isSavingAssignment={isSavingAssignment}
            isSavingStatus={isSavingStatus}
            isSavingAutomationBlock={isSavingAutomationBlock}
            error={railError}
            onContactNameChange={setContactName}
            onContactNotesChange={setContactNotes}
            onSaveContact={() => void handleSaveContact()}
            onAssign={(userId) => void handleAssign(userId)}
            onStatus={(status) => void handleStatus(status)}
            onToggleAutomation={(enabled) =>
              void handleToggleAutomation(enabled)
            }
          />
        </div>
      </div>

      <div className="xl:hidden">
        <ConversationRail
          conversation={selected}
          users={users}
          blockedContact={selectedBlocked}
          contactName={contactName}
          contactNotes={contactNotes}
          isSavingContact={isSavingContact}
          isSavingAssignment={isSavingAssignment}
          isSavingStatus={isSavingStatus}
          isSavingAutomationBlock={isSavingAutomationBlock}
          error={railError}
          onContactNameChange={setContactName}
          onContactNotesChange={setContactNotes}
          onSaveContact={() => void handleSaveContact()}
          onAssign={(userId) => void handleAssign(userId)}
          onStatus={(status) => void handleStatus(status)}
          onToggleAutomation={(enabled) => void handleToggleAutomation(enabled)}
        />
      </div>
    </div>
  );
}
