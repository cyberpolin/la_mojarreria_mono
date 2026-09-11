"use client";

import { useEffect, useRef } from "react";
import {
  accountStatusLabel,
  conversationTitle,
  cx,
  formatDate,
  isAccountConnected,
  messageStatusLabel,
} from "./helpers";
import { LinkedMessageText } from "./LinkedMessageText";
import { isLocationMessage, LocationMessageCard } from "./LocationMessageCard";
import type { InboxConversation, InboxMessage } from "./types";
import { Badge, Button, TextArea } from "./ui";

function directionLabel(direction: string) {
  if (direction === "inbound") return "Cliente";
  if (direction === "bot") return "Bot";
  if (direction === "system") return "Sistema";
  return "Equipo";
}

function MessageBubble({ message }: { message: InboxMessage }) {
  const isInbound = message.direction === "inbound";
  const isSystem = message.direction === "system";
  const isBot = message.direction === "bot";
  const failed = message.status === "failed";

  if (isSystem) {
    return (
      <div className="mx-auto max-w-[86%] rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-center text-xs text-slate-500">
        <p>{message.body}</p>
        <p className="mt-1">{formatDate(message.createdAt)}</p>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "max-w-[78%] rounded-lg p-3",
        isInbound && "border border-slate-200 bg-white text-slate-800",
        isBot && "border border-slate-400 bg-slate-100 text-slate-900",
        !isInbound &&
          !isBot &&
          (failed
            ? "ml-auto border border-slate-400 bg-slate-200 text-slate-900"
            : "ml-auto bg-slate-950 text-white"),
      )}
    >
      <p
        className={cx(
          "text-xs font-semibold",
          isInbound || isBot ? "text-slate-500" : "text-slate-300",
          failed && "text-slate-600",
        )}
      >
        {directionLabel(message.direction)} · {formatDate(message.createdAt)}
      </p>
      {isLocationMessage(message) ? (
        <div className="mt-2">
          <LocationMessageCard
            message={message}
            inverted={!isInbound && !isBot && !failed}
          />
        </div>
      ) : (
        <LinkedMessageText
          text={message.body}
          className="mt-2 whitespace-pre-wrap break-words text-sm"
          linkClassName={
            isInbound || isBot || failed
              ? "break-all underline"
              : "break-all underline text-white"
          }
        />
      )}
      {messageStatusLabel(message.status) ? (
        <p className="mt-2 text-xs opacity-70">
          {messageStatusLabel(message.status)}
        </p>
      ) : null}
    </div>
  );
}

export function ConversationThread({
  conversation,
  messages,
  draft,
  isLoading,
  isLoadingOlder,
  hasMore,
  isSending,
  canSend,
  error,
  onDraftChange,
  onSend,
  onLoadOlder,
}: {
  conversation: InboxConversation | null;
  messages: InboxMessage[];
  draft: string;
  isLoading: boolean;
  isLoadingOlder: boolean;
  hasMore: boolean;
  isSending: boolean;
  canSend: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onLoadOlder: () => void;
}) {
  const account = conversation?.whatsappAccount ?? null;
  const connected = isAccountConnected(account?.status);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation?.id, messages.length]);

  return (
    <section className="flex min-h-[640px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      {conversation ? (
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-950">
                {conversationTitle(conversation)}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {conversation.contact?.phoneNumber ?? "-"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                via {account?.displayName ?? "Numero"}
                {account?.phoneNumber ? ` · ${account.phoneNumber}` : ""}
              </p>
            </div>
            <Badge tone={connected ? "dark" : "warn"}>
              {accountStatusLabel(account?.status ?? "pending")}
            </Badge>
          </div>
          {!connected ? (
            <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
              Este numero no esta conectado. Conectalo en{" "}
              <a
                href="/main/whatsapp-accounts"
                className="font-semibold underline"
              >
                Numeros WhatsApp
              </a>{" "}
              para poder responder.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-950">Conversacion</h2>
          <p className="mt-1 text-sm text-slate-500">
            Selecciona una conversacion para atenderla.
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
        {conversation && hasMore ? (
          <div className="flex justify-center">
            <Button
              variant="secondary"
              disabled={isLoadingOlder}
              onClick={onLoadOlder}
            >
              {isLoadingOlder ? "Cargando..." : "Cargar anteriores"}
            </Button>
          </div>
        ) : null}
        {isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
            Cargando conversacion...
          </div>
        ) : null}
        {!isLoading && conversation && messages.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Esta conversacion no tiene mensajes todavia.
          </div>
        ) : null}
        {!conversation ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Elige un chat de la lista o abre un enlace directo.
          </div>
        ) : null}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200 p-4">
        {error ? (
          <div className="mb-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
            {error}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <TextArea
            placeholder={
              connected
                ? "Escribe un mensaje..."
                : "No se puede enviar: numero desconectado"
            }
            rows={2}
            value={draft}
            disabled={!canSend}
            onChange={onDraftChange}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            disabled={!canSend || !draft.trim() || isSending}
            onClick={onSend}
          >
            {isSending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>
    </section>
  );
}
