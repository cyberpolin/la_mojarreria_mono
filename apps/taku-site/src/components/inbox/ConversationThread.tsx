"use client";

import { useEffect, useRef, useState } from "react";
import {
  accountStatusLabel,
  conversationTitle,
  cx,
  digitsPhone,
  formatDate,
  isAccountConnected,
  isGroupConversation,
  messageStatusLabel,
} from "./helpers";
import { FaqIntentLight } from "./FaqIntentLight";
import { shouldShowFaqSemaforo } from "./faqSemaforo";
import { LinkedMessageText } from "./LinkedMessageText";
import { isLocationMessage, LocationMessageCard } from "./LocationMessageCard";
import { MotoIcon } from "./ConversationAvatar";
import { AssignOrderSheet } from "./AssignOrderSheet";
import { isDriverInList, useKnownDriverPhones } from "./drivers";
import { KebabIcon, MobileContextMenu } from "./mobile-shell";
import { completeOrderAssignment } from "./assignDeliveryOrder";
import type { DeliveryOrder } from "./pendingOrders";
import type { InboxConversation, InboxMessage } from "./types";
import { Badge, Button, TextArea } from "./ui";

function directionLabel(direction: string) {
  if (direction === "inbound") return "Cliente";
  if (direction === "bot") return "Bot";
  if (direction === "system") return "Sistema";
  return "Equipo";
}

function MessageBubble({
  message,
  clickable,
  onOpen,
  account,
  conversation,
  isDriverSender = false,
}: {
  message: InboxMessage;
  clickable?: boolean;
  onOpen?: () => void;
  account?: InboxConversation["whatsappAccount"];
  conversation?: InboxConversation | null;
  isDriverSender?: boolean;
}) {
  const isInbound = message.direction === "inbound";
  const isSystem = message.direction === "system";
  const isBot = message.direction === "bot";
  const failed = message.status === "failed";
  const senderLabel =
    message.senderName?.trim() ||
    (message.senderPhone
      ? message.senderPhone
      : directionLabel(message.direction));

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
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={(event) => {
        if (!clickable || !onOpen) return;
        if ((event.target as HTMLElement).closest("a, button")) return;
        onOpen();
      }}
      onKeyDown={(event) => {
        if (!clickable || !onOpen) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cx(
        isLocationMessage(message)
          ? "w-[88%] max-w-[88%] rounded-lg p-3"
          : "max-w-[78%] rounded-lg p-3",
        clickable && "cursor-pointer hover:bg-slate-50",
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
          "flex items-center gap-1 text-xs font-semibold",
          isInbound || isBot ? "text-slate-500" : "text-slate-300",
          failed && "text-slate-600",
        )}
      >
        {isDriverSender ? <MotoIcon className="h-3.5 w-3.5" /> : null}
        {senderLabel} · {formatDate(message.createdAt)}
      </p>
      {isLocationMessage(message) ? (
        <div className="mt-2">
          <LocationMessageCard
            message={message}
            inverted={!isInbound && !isBot && !failed}
            account={account}
            conversation={conversation}
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
  onStartPrivateChat,
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
  onStartPrivateChat?: (message: InboxMessage) => void;
}) {
  const account = conversation?.whatsappAccount ?? null;
  const connected = isAccountConnected(account?.status);
  const isGroup = isGroupConversation(conversation);
  const [menuMessage, setMenuMessage] = useState<InboxMessage | null>(null);
  const [assignedOrder, setAssignedOrder] = useState<DeliveryOrder | null>(
    null,
  );
  const [assignError, setAssignError] = useState<string | null>(null);
  const [customerNotified, setCustomerNotified] = useState(false);
  const driverPhones = useKnownDriverPhones();
  const endRef = useRef<HTMLDivElement | null>(null);

  async function handleAssignOrder(message: InboxMessage) {
    const phone = digitsPhone(message.senderPhone ?? "");
    if (!phone) {
      setAssignError(
        "Este mensaje no trae el telefono del remitente. Espera un mensaje nuevo.",
      );
      return;
    }
    const result = await completeOrderAssignment({
      driverPhone: phone,
      driverName: message.senderName,
    });
    if (!result.ok) {
      setAssignError(result.error);
      setCustomerNotified(false);
      if (result.order) setAssignedOrder(result.order);
      return;
    }
    setAssignError(null);
    setCustomerNotified(true);
    setAssignedOrder(result.order);
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation?.id, messages.length]);

  return (
    <section className="relative flex min-h-[640px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      {conversation ? (
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-950">
                {conversation.pinned ? "📌 " : ""}
                {conversationTitle(conversation)}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isGroupConversation(conversation)
                  ? conversation.pinned
                    ? "Grupo fijado de WhatsApp"
                    : "Grupo de WhatsApp"
                  : (conversation.contact?.phoneNumber ?? "-")}
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
        {messages.map((message) => {
          const showDriverMenu =
            Boolean(conversation?.pinned) &&
            isGroup &&
            message.direction === "inbound";
          return (
            <div key={message.id} className="flex items-end gap-1">
              <FaqIntentLight
                visible={shouldShowFaqSemaforo(messages, message.id)}
              />
              <MessageBubble
                message={message}
                account={account}
                conversation={conversation}
                isDriverSender={isDriverInList(
                  driverPhones,
                  message.senderPhone,
                )}
                clickable={showDriverMenu}
                onOpen={() => setMenuMessage(message)}
              />
              {showDriverMenu ? (
                <button
                  type="button"
                  onClick={() => setMenuMessage(message)}
                  className="mb-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500"
                  aria-label="Opciones del repartidor"
                >
                  <KebabIcon className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200 p-4">
        {error || assignError ? (
          <div className="mb-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
            {error ?? assignError}
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
      {menuMessage ? (
        <MobileContextMenu
          title={
            menuMessage.senderName?.trim() ||
            menuMessage.senderPhone ||
            "Mensaje"
          }
          items={[
            ...(conversation?.pinned
              ? [
                  {
                    label: "Asignar pedido",
                    onSelect: () => {
                      void handleAssignOrder(menuMessage);
                    },
                  },
                ]
              : []),
            {
              label: "Iniciar chat privado",
              onSelect: () => onStartPrivateChat?.(menuMessage),
            },
          ]}
          onClose={() => setMenuMessage(null)}
        />
      ) : null}
      {assignedOrder ? (
        <AssignOrderSheet
          order={assignedOrder}
          customerNotified={customerNotified}
          onClose={() => setAssignedOrder(null)}
        />
      ) : null}
    </section>
  );
}
