"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceSession } from "@/lib/taku-api";
import {
  fetchConversationByPhone,
  fetchNewestMessages,
  markConversationRead,
  sendConversationMessage,
} from "./api";
import {
  accountStatusLabel,
  cx,
  digitsPhone,
  formatTime,
  isAccountConnected,
  isFullConversation,
  messageStatusLabel,
  mobileListPath,
  mobileThreadPath,
  readConversationId,
  readMessageFromEvent,
  upsertMessage,
} from "./helpers";
import type {
  InboxConversation,
  InboxMessage,
  InboxWhatsAppAccount,
} from "./types";
import { LinkedMessageText } from "./LinkedMessageText";
import { isLocationMessage, LocationMessageCard } from "./LocationMessageCard";
import { MobileAuthGate, MobilePhoneFrame } from "./mobile-shell";
import {
  playIncomingSound,
  unlockIncomingSound,
  useArmIncomingSound,
} from "./playIncomingSound";
import { useInboxRealtime } from "./useInboxRealtime";

const POLL_INTERVAL_MS = 6000;

function normalizePhoneParam(value: string) {
  return digitsPhone(decodeURIComponent(value));
}

function MobileBubble({ message }: { message: InboxMessage }) {
  const isInbound = message.direction === "inbound";
  const isSystem = message.direction === "system";
  const isBot = message.direction === "bot";
  const failed = message.status === "failed";

  if (isSystem) {
    return (
      <div className="mx-auto max-w-[90%] rounded-full bg-slate-200/80 px-3 py-1 text-center text-[11px] text-slate-600">
        {message.body}
      </div>
    );
  }

  return (
    <div
      className={cx(
        "max-w-[82%] rounded-2xl px-3 py-2 shadow-sm",
        isInbound && "self-start rounded-tl-md bg-white text-slate-900",
        isBot && "self-start rounded-tl-md bg-slate-200 text-slate-900",
        !isInbound &&
          !isBot &&
          (failed
            ? "self-end rounded-tr-md bg-slate-300 text-slate-900"
            : "self-end rounded-tr-md bg-slate-800 text-white"),
      )}
    >
      {isBot ? (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Bot
        </p>
      ) : null}
      {isLocationMessage(message) ? (
        <LocationMessageCard
          message={message}
          inverted={!isInbound && !isBot && !failed}
        />
      ) : (
        <LinkedMessageText
          text={message.body}
          className="whitespace-pre-wrap break-words text-sm leading-5"
          linkClassName={
            isInbound || isBot || failed
              ? "break-all underline"
              : "break-all underline text-white"
          }
        />
      )}
      <p
        className={cx(
          "mt-1 text-right text-[10px]",
          isInbound || isBot || failed ? "text-slate-500" : "text-slate-300",
        )}
      >
        {formatTime(message.createdAt)}
        {messageStatusLabel(message.status)
          ? ` · ${messageStatusLabel(message.status)}`
          : ""}
      </p>
    </div>
  );
}

export function MobileConversation({
  phone,
  account = null,
  scoped = false,
}: {
  phone: string;
  account?: InboxWhatsAppAccount | null;
  scoped?: boolean;
}) {
  const router = useRouter();
  const lockedPhone = normalizePhoneParam(phone);
  const [conversation, setConversation] = useState<InboxConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const threadReadyRef = useRef(false);
  useArmIncomingSound();

  const loadThread = useCallback(async () => {
    if (!getWorkspaceSession()) {
      setNeedsAuth(true);
      setLoading(false);
      return;
    }
    setNeedsAuth(false);
    try {
      const next = await fetchConversationByPhone(lockedPhone, account?.id);
      if (!next) {
        setConversation(null);
        setMessages([]);
        conversationIdRef.current = null;
        setError("No hay conversacion para este numero.");
        return;
      }
      conversationIdRef.current = next.id;
      setConversation(next);
      const history = await fetchNewestMessages(next.id);
      if (threadReadyRef.current) {
        const heardNewInbound = history.items.some(
          (item) =>
            item.direction === "inbound" &&
            !seenMessageIdsRef.current.has(item.id),
        );
        if (heardNewInbound) playIncomingSound();
      }
      for (const item of history.items) {
        seenMessageIdsRef.current.add(item.id);
      }
      threadReadyRef.current = true;
      setMessages(history.items);
      setError(null);
      if (next.unreadCount > 0) {
        void markConversationRead(next.id).catch(() => undefined);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cargar la conversacion.",
      );
    } finally {
      setLoading(false);
    }
  }, [account?.id, lockedPhone]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const handleMessageCreated = useCallback((payload: unknown) => {
    const message = readMessageFromEvent(payload);
    const conversationId = readConversationId(payload);
    if (
      !message ||
      !conversationId ||
      conversationId !== conversationIdRef.current
    ) {
      return;
    }
    if (message.direction === "inbound") playIncomingSound();
    setMessages((current) => upsertMessage(current, message));
    if (
      payload &&
      typeof payload === "object" &&
      "conversation" in payload &&
      isFullConversation((payload as { conversation: unknown }).conversation)
    ) {
      setConversation(
        (payload as { conversation: InboxConversation }).conversation,
      );
    }
  }, []);

  const socketStatus = useInboxRealtime({
    enabled: Boolean(conversation) && !needsAuth,
    onMessageCreated: handleMessageCreated,
    onConversationUpdated: (payload) => {
      if (!payload || typeof payload !== "object") return;
      const record = payload as InboxConversation;
      if (record.id && record.id === conversationIdRef.current) {
        setConversation((current) =>
          current ? { ...current, ...record } : current,
        );
      }
    },
    onReconnect: () => {
      void loadThread();
    },
  });

  useEffect(() => {
    if (socketStatus !== "disconnected" || needsAuth) return;
    const intervalId = window.setInterval(() => {
      void loadThread();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadThread, needsAuth, socketStatus]);

  async function handleSend() {
    if (!conversation || !draft.trim()) return;
    if (!isAccountConnected(conversation.whatsappAccount?.status)) return;
    const body = draft.trim();
    const clientKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());
    const optimistic: InboxMessage = {
      id: `optimistic:${clientKey}`,
      clientKey,
      direction: "outbound",
      body,
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    setDraft("");
    setSending(true);
    setMessages((current) => upsertMessage(current, optimistic));
    try {
      const persisted = await sendConversationMessage(conversation.id, body);
      setMessages((current) => {
        const withoutOptimistic = current.filter(
          (item) => item.clientKey !== clientKey && item.id !== optimistic.id,
        );
        return upsertMessage(withoutOptimistic, persisted);
      });
    } catch (caught) {
      setMessages((current) =>
        current.map((item) =>
          item.clientKey === clientKey || item.id === optimistic.id
            ? { ...item, status: "failed" }
            : item,
        ),
      );
      setError(caught instanceof Error ? caught.message : "No se pudo enviar.");
    } finally {
      setSending(false);
    }
  }

  if (needsAuth) {
    return (
      <MobileAuthGate
        next={
          scoped
            ? mobileThreadPath(lockedPhone, account)
            : `/conversation-mobile/${lockedPhone}`
        }
      />
    );
  }

  const canSend = Boolean(
    conversation && isAccountConnected(conversation.whatsappAccount?.status),
  );
  const title =
    conversation?.contact?.name ??
    conversation?.contact?.phoneNumber ??
    lockedPhone;

  return (
    <MobilePhoneFrame>
      <header className="flex items-center gap-2 bg-slate-900 px-2 py-2 text-white">
        <button
          type="button"
          onClick={() =>
            router.push(
              scoped ? mobileListPath(account) : "/conversation-mobile",
            )
          }
          className="grid h-10 w-10 place-items-center text-lg"
          aria-label="Volver"
        >
          ←
        </button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-700 text-sm font-semibold">
          {title.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-[11px] text-slate-300">
            {lockedPhone}
            {conversation?.whatsappAccount
              ? ` · via ${conversation.whatsappAccount.displayName}`
              : ""}
            {conversation?.whatsappAccount
              ? ` · ${accountStatusLabel(conversation.whatsappAccount.status)}`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            unlockIncomingSound();
            playIncomingSound();
          }}
          className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold"
        >
          Sonido
        </button>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-slate-200 px-3 py-3"
        onClick={unlockIncomingSound}
      >
        {loading ? (
          <p className="text-center text-sm text-slate-600">Cargando...</p>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-white/80 px-3 py-2 text-center text-sm text-slate-700">
            {error}
          </p>
        ) : null}
        {messages.map((message) => (
          <MobileBubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </div>

      {!canSend && conversation ? (
        <p className="bg-slate-200 px-3 py-2 text-center text-xs text-slate-600">
          Numero de negocio desconectado. No se puede enviar.
        </p>
      ) : null}

      <form
        className="flex items-end gap-2 bg-slate-100 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        <textarea
          rows={1}
          value={draft}
          disabled={!canSend}
          placeholder={canSend ? "Mensaje" : "No disponible"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-2.5 text-sm outline-none disabled:bg-slate-200"
        />
        <button
          type="submit"
          disabled={!canSend || !draft.trim() || sending}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-900 text-white disabled:opacity-40"
          aria-label="Enviar"
        >
          {sending ? "..." : "➤"}
        </button>
      </form>
    </MobilePhoneFrame>
  );
}
