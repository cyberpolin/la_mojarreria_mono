"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type ConversationMessage = {
  id: string;
  phone: string;
  text: string;
  direction: "inbound" | "outbound";
  timestamp: string;
};

type Conversation = {
  phone: string;
  lastMessage: ConversationMessage;
  messageCount: number;
  updatedAt: string;
};

type WaStatus = {
  ok?: boolean;
  status?: {
    active?: boolean;
    connected?: boolean;
    connection?: "connecting" | "open" | "close";
    hasQr?: boolean;
    state?: string;
  };
  sessionIssue?: {
    detected: boolean;
    reason: string | null;
    count: number;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    lastMessage: string | null;
  };
  error?: string;
};

type ConversationsResponse = {
  ok?: boolean;
  conversations?: Conversation[];
  error?: string;
};

type MessagesResponse = {
  ok?: boolean;
  phone?: string;
  messages?: ConversationMessage[];
  error?: string;
};

type WaQrResponse = {
  ok?: boolean;
  qr?: string | null;
  qrImage?: string | null;
  connected?: boolean;
  connection?: "connecting" | "open" | "close";
  hasQr?: boolean;
  error?: string;
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeMessageOrder(messages: ConversationMessage[]) {
  return [...messages].sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

export function WaChatClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () =>
      selectedPhone
        ? (conversations.find(
            (conversation) => conversation.phone === selectedPhone,
          ) ?? null)
        : null,
    [conversations, selectedPhone],
  );

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/wa-chat/status", { cache: "no-store" });
    const payload = (await response
      .json()
      .catch(() => null)) as WaStatus | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(
        payload?.error ?? `WA status failed (${response.status})`,
      );
    }
    setStatus(payload);
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const response = await fetch("/api/wa-chat/conversations?limit=100", {
        cache: "no-store",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as ConversationsResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error ?? `WA conversations failed (${response.status})`,
        );
      }

      const nextConversations = payload.conversations ?? [];
      setConversations(nextConversations);
      setSelectedPhone((current) => {
        if (
          current &&
          nextConversations.some((item) => item.phone === current)
        ) {
          return current;
        }
        return nextConversations[0]?.phone ?? null;
      });
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async (phone: string) => {
    setLoadingMessages(true);
    try {
      const response = await fetch(
        `/api/wa-chat/conversations/${encodeURIComponent(phone)}/messages?limit=120`,
        { cache: "no-store" },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as MessagesResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error ?? `WA messages failed (${response.status})`,
        );
      }

      setMessages(normalizeMessageOrder(payload.messages ?? []));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await Promise.all([
        loadStatus(),
        loadConversations(),
        selectedPhone ? loadMessages(selectedPhone) : Promise.resolve(),
      ]);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to load WhatsApp chat",
      );
    }
  }, [loadConversations, loadMessages, loadStatus, selectedPhone]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedPhone) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedPhone).catch((messagesError) => {
      setError(
        messagesError instanceof Error
          ? messagesError.message
          : "Failed to load messages",
      );
    });
  }, [loadMessages, selectedPhone]);

  useEffect(() => {
    if (!live) return;

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [live, refresh]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPhone || !draft.trim() || sending) return;

    const text = draft.trim();
    setSending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/wa-chat/conversations/${encodeURIComponent(selectedPhone)}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error ?? `WA send message failed (${response.status})`,
        );
      }

      setDraft("");
      await Promise.all([loadConversations(), loadMessages(selectedPhone)]);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  }

  async function loadQr(): Promise<WaQrResponse> {
    const response = await fetch("/api/wa-chat/qr", { cache: "no-store" });
    const payload = (await response
      .json()
      .catch(() => null)) as WaQrResponse | null;

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error ?? `WA QR failed (${response.status})`);
    }

    return payload;
  }

  async function resetConnection() {
    if (resetting) return;

    setResetting(true);
    setQrModalOpen(true);
    setQrImage(null);
    setQrStatus("Resetting WhatsApp auth session...");
    setError(null);

    try {
      const response = await fetch("/api/wa-chat/reset-session", {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error ?? `WA reset session failed (${response.status})`,
        );
      }

      setQrStatus("Waiting for new QR...");
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const qrPayload = await loadQr();
        if (qrPayload.qrImage) {
          setQrImage(qrPayload.qrImage);
          setQrStatus("Scan this QR with WhatsApp.");
          await loadStatus();
          return;
        }

        if (qrPayload.connected) {
          setQrStatus("WhatsApp is already connected.");
          await loadStatus();
          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }

      setQrStatus("QR not ready yet. Keep this modal open or refresh.");
    } catch (resetError) {
      const message =
        resetError instanceof Error
          ? resetError.message
          : "Failed to reset WhatsApp connection";
      setQrStatus(message);
      setError(message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <div className="grid min-h-[72vh] overflow-hidden rounded-lg border border-slate-800 bg-slate-950 lg:grid-cols-[340px_1fr]">
        <aside className="border-b border-slate-800 bg-slate-950 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Chats</h2>
              <p className="text-xs text-slate-400">
                {conversations.length} conversations
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void resetConnection()}
                disabled={resetting}
                className="rounded-md border border-red-500/50 px-2.5 py-1.5 text-xs text-red-100 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div className="text-xs text-slate-300">
              WA:{" "}
              <span
                className={
                  status?.status?.connected
                    ? "text-emerald-300"
                    : "text-amber-300"
                }
              >
                {status?.status?.state ?? "unknown"}
              </span>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={live}
                onChange={(event) => setLive(event.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
              Live
            </label>
          </div>

          {error ? (
            <div className="border-b border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-100">
              {error}
            </div>
          ) : null}

          {status?.sessionIssue?.detected ? (
            <div className="border-b border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-100">
              WhatsApp session issue detected: {status.sessionIssue.reason}.{" "}
              {status.sessionIssue.count} events since{" "}
              {status.sessionIssue.firstSeenAt
                ? formatShortTime(status.sessionIssue.firstSeenAt)
                : "unknown"}
              .
            </div>
          ) : null}

          <div className="max-h-[62vh] overflow-y-auto">
            {loadingConversations && conversations.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-400">
                Loading chats...
              </div>
            ) : null}

            {!loadingConversations && conversations.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-400">
                No conversations yet.
              </div>
            ) : null}

            {conversations.map((conversation) => (
              <button
                key={conversation.phone}
                type="button"
                onClick={() => setSelectedPhone(conversation.phone)}
                className={`block w-full border-b border-slate-900 px-4 py-3 text-left hover:bg-slate-900 ${
                  selectedPhone === conversation.phone ? "bg-slate-900" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      +{conversation.phone}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {conversation.lastMessage.direction === "outbound"
                        ? "You: "
                        : ""}
                      {conversation.lastMessage.text}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-slate-500">
                      {formatShortTime(conversation.updatedAt)}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {conversation.messageCount}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[72vh] flex-col bg-slate-950">
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                {selectedConversation
                  ? `+${selectedConversation.phone}`
                  : "No chat selected"}
              </h2>
              <p className="text-xs text-slate-400">
                {selectedConversation
                  ? `${selectedConversation.messageCount} messages`
                  : "Select a conversation"}
              </p>
            </div>
            {loadingMessages ? (
              <span className="text-xs text-slate-500">Loading...</span>
            ) : null}
          </header>

          <div className="flex-1 overflow-y-auto bg-slate-950 px-4 py-4">
            {!selectedPhone ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Select a conversation to read messages.
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No messages in this conversation.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {messages.map((message) => {
                  const outbound = message.direction === "outbound";
                  return (
                    <div
                      key={`${message.id}-${message.timestamp}`}
                      className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                          outbound
                            ? "bg-emerald-700 text-white"
                            : "bg-slate-800 text-slate-100"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {message.text}
                        </p>
                        <p
                          className={`mt-1 text-right text-[11px] ${
                            outbound ? "text-emerald-100" : "text-slate-400"
                          }`}
                        >
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form
            onSubmit={sendMessage}
            className="flex items-end gap-2 border-t border-slate-800 bg-slate-950 p-3"
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!selectedPhone || sending}
              rows={2}
              placeholder={
                selectedPhone ? "Type a message" : "Select a conversation first"
              }
              className="min-h-11 flex-1 resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!selectedPhone || !draft.trim() || sending}
              className="h-11 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {sending ? "Sending" : "Send"}
            </button>
          </form>
        </section>
      </div>
      {qrModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">
                  Reset WhatsApp Connection
                </h2>
                <p className="mt-1 text-sm text-slate-400">{qrStatus}</p>
              </div>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="flex min-h-80 items-center justify-center rounded-lg border border-slate-800 bg-white p-4">
              {qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrImage}
                  alt="WhatsApp pairing QR"
                  className="h-72 w-72"
                />
              ) : (
                <div className="text-center text-sm text-slate-700">
                  {resetting ? "Preparing QR..." : qrStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
