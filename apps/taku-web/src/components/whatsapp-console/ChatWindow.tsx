"use client";

import { useEffect, useRef } from "react";
import type { TakuChat, TakuChatMessage } from "./types";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

export function ChatWindow({
  chat,
  messages,
  loading,
  draft,
  sending,
  onDraftChange,
  onSend,
}: {
  chat: TakuChat | null;
  messages: TakuChatMessage[];
  loading: boolean;
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !shouldStickToBottomRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, chat?.id]);

  return (
    <section className="flex min-h-0 flex-col bg-slate-950">
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-100">
            {chat?.name ?? "Selecciona un chat"}
          </h2>
          <p className="text-xs text-slate-500">
            {chat
              ? `${chat.messageCount} mensajes · ${chat.isGroup ? "grupo" : "contacto"}`
              : "Historial persistente de wa-service"}
          </p>
        </div>
        {loading ? (
          <span className="text-xs text-slate-500">Cargando</span>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const node = event.currentTarget;
          const distanceFromBottom =
            node.scrollHeight - node.scrollTop - node.clientHeight;
          shouldStickToBottomRef.current = distanceFromBottom < 120;
        }}
        className="min-h-0 flex-1 overflow-y-auto bg-slate-950 px-4 py-4"
      >
        {!chat ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Abre un chat para ver y contestar mensajes.
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No hay mensajes guardados para este chat.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      <MessageInput
        value={draft}
        disabled={!chat}
        sending={sending}
        onChange={onDraftChange}
        onSend={onSend}
      />
    </section>
  );
}
