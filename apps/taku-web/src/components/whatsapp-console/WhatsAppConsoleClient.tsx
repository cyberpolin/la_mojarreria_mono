"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getStoredSession, type TakuSession } from "@/app/session";
import { ChatList } from "./ChatList";
import { ChatWindow } from "./ChatWindow";
import { ConnectionStatus } from "./ConnectionStatus";
import { listChats, listMessages, sendMessage } from "./api";
import type { SyncState, TakuChat, TakuChatMessage } from "./types";

function upsertMessages(
  current: TakuChatMessage[],
  incoming: TakuChatMessage[],
): TakuChatMessage[] {
  const byId = new Map<string, TakuChatMessage>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

function filterChats(chats: TakuChat[], query: string): TakuChat[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return chats;

  return chats.filter((chat) => {
    const lastMessage = chat.lastMessage?.body.toLowerCase() ?? "";
    return (
      chat.name.toLowerCase().includes(normalized) ||
      chat.phone.toLowerCase().includes(normalized) ||
      lastMessage.includes(normalized)
    );
  });
}

function optimisticMessage(params: {
  chatId: string;
  body: string;
}): TakuChatMessage {
  const timestamp = new Date().toISOString();
  return {
    id: `${params.chatId}:optimistic:${timestamp}`,
    chatId: params.chatId,
    phone: params.chatId,
    fromMe: true,
    senderName: "TAKU Console",
    senderPhone: null,
    body: params.body,
    type: "text",
    mediaUrl: null,
    mimeType: null,
    fileName: null,
    timestamp,
    status: "sent",
    raw: { optimistic: true },
  };
}

export function WhatsAppConsoleClient() {
  const [session, setSession] = useState<TakuSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [chats, setChats] = useState<TakuChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messagesByChat, setMessagesByChat] = useState<
    Record<string, TakuChatMessage[]>
  >({});
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("syncing");
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedChatRef = useRef<string | null>(null);
  const failedPollsRef = useRef(0);

  const role = session?.role ?? "client";

  const visibleChats = useMemo(() => filterChats(chats, query), [chats, query]);
  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );
  const activeMessages = selectedChatId
    ? (messagesByChat[selectedChatId] ?? [])
    : [];

  const refreshChats = useCallback(async () => {
    setLoadingChats(true);
    const nextChats = await listChats(role);
    setChats(nextChats);
    setSelectedChatId((current) => {
      const next =
        current && nextChats.some((chat) => chat.id === current)
          ? current
          : (nextChats[0]?.id ?? null);
      selectedChatRef.current = next;
      return next;
    });
    setLoadingChats(false);
  }, [role]);

  const refreshMessages = useCallback(
    async (chatId: string) => {
      setLoadingMessages(true);
      const nextMessages = await listMessages({ role, chatId });
      setMessagesByChat((current) => ({
        ...current,
        [chatId]: upsertMessages(current[chatId] ?? [], nextMessages),
      }));
      setLoadingMessages(false);
    },
    [role],
  );

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      setError(null);
      setSyncState(failedPollsRef.current > 0 ? "reconnecting" : "syncing");
      await refreshChats();
      const chatId = selectedChatRef.current;
      if (chatId) await refreshMessages(chatId);
      failedPollsRef.current = 0;
      setSyncState("connected");
    } catch (refreshError) {
      failedPollsRef.current += 1;
      setSyncState(failedPollsRef.current > 1 ? "offline" : "reconnecting");
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "No se pudo sincronizar WhatsApp",
      );
    } finally {
      setLoadingChats(false);
      setLoadingMessages(false);
    }
  }, [refreshChats, refreshMessages, session]);

  useEffect(() => {
    const stored = getStoredSession();
    setSession(stored?.session ?? null);
    setSessionChecked(true);
  }, []);

  useEffect(() => {
    selectedChatRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    if (!sessionChecked || !session) return;
    void refresh();
  }, [refresh, session, sessionChecked]);

  useEffect(() => {
    if (!session) return;
    const intervalId = window.setInterval(
      () => {
        void refresh();
      },
      syncState === "offline" ? 8000 : 2500,
    );
    return () => window.clearInterval(intervalId);
  }, [refresh, session, syncState]);

  useEffect(() => {
    if (!selectedChatId || !session) return;
    void refreshMessages(selectedChatId).catch((messagesError) => {
      setError(
        messagesError instanceof Error
          ? messagesError.message
          : "No se pudo cargar el historial",
      );
    });
  }, [refreshMessages, selectedChatId, session]);

  async function handleSend() {
    const chatId = selectedChatRef.current;
    const body = draft.trim();
    if (!chatId || !body || sending) return;

    const optimistic = optimisticMessage({ chatId, body });
    setDraft("");
    setSending(true);
    setMessagesByChat((current) => ({
      ...current,
      [chatId]: upsertMessages(current[chatId] ?? [], [optimistic]),
    }));

    try {
      await sendMessage({ role, chatId, body });
      await Promise.all([refreshChats(), refreshMessages(chatId)]);
      setSyncState("connected");
    } catch (sendError) {
      setMessagesByChat((current) => ({
        ...current,
        [chatId]: (current[chatId] ?? []).map((message) =>
          message.id === optimistic.id
            ? { ...message, status: "error" }
            : message,
        ),
      }));
      setError(
        sendError instanceof Error
          ? sendError.message
          : "No se pudo enviar el mensaje",
      );
    } finally {
      setSending(false);
    }
  }

  if (sessionChecked && !session) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-xl font-semibold text-slate-50">Inicia sesion</h1>
          <p className="mt-2 text-sm text-slate-400">
            La consola de WhatsApp usa la sesion de TAKU para no exponer
            credenciales del servicio.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-950 hover:bg-white"
          >
            Ir a login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="mx-auto flex h-screen w-full max-w-7xl flex-col px-4 py-4 md:px-6">
        <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              TAKU WhatsApp
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">
              Consola de mensajes
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus state={syncState} />
            <Link
              href="/admin"
              className="flex min-h-11 items-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900"
            >
              Admin
            </Link>
          </div>
        </header>

        {error ? (
          <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            {error}
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 lg:grid-cols-[360px_1fr]">
          <ChatList
            chats={visibleChats}
            activeChatId={selectedChatId}
            query={query}
            loading={loadingChats}
            onQueryChange={setQuery}
            onSelectChat={(chatId) => {
              selectedChatRef.current = chatId;
              setSelectedChatId(chatId);
            }}
          />
          <ChatWindow
            chat={activeChat}
            messages={activeMessages}
            loading={loadingMessages}
            draft={draft}
            sending={sending}
            onDraftChange={setDraft}
            onSend={() => void handleSend()}
          />
        </div>
      </div>
    </main>
  );
}
