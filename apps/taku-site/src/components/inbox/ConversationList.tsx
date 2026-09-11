"use client";

import {
  accountStatusLabel,
  conversationStatusLabel,
  conversationTitle,
  cx,
  formatTime,
} from "./helpers";
import type {
  ConversationFilterId,
  InboxConversation,
  InboxWhatsAppAccount,
} from "./types";
import { Badge } from "./ui";

const filters: Array<{ id: ConversationFilterId; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "open", label: "Abiertas" },
  { id: "unread", label: "Sin responder" },
  { id: "mine", label: "Asignadas a mi" },
  { id: "unassigned", label: "Sin asignar" },
  { id: "closed", label: "Cerradas" },
  { id: "archived", label: "Archivadas" },
  { id: "blocked", label: "Bloqueados" },
];

export function ConversationList({
  conversations,
  accounts,
  selectedId,
  filter,
  search,
  accountId,
  isLoading,
  error,
  onFilterChange,
  onSearchChange,
  onAccountChange,
  onSelect,
}: {
  conversations: InboxConversation[];
  accounts: InboxWhatsAppAccount[];
  selectedId: string | null;
  filter: ConversationFilterId;
  search: string;
  accountId: string;
  isLoading: boolean;
  error: string | null;
  onFilterChange: (filter: ConversationFilterId) => void;
  onSearchChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onSelect: (conversationId: string) => void;
}) {
  const emptyLabel = search.trim()
    ? "No hay resultados para esa busqueda."
    : filter === "all"
      ? "No hay conversaciones."
      : "No hay conversaciones para este filtro.";

  return (
    <aside className="flex min-h-[640px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid gap-3 border-b border-slate-200 p-4">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={cx(
                "min-h-10 rounded-full px-3 text-sm font-semibold",
                filter === item.id
                  ? "bg-slate-950 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-slate-950",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, telefono o mensaje..."
          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
        />
        <select
          value={accountId}
          onChange={(event) => onAccountChange(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
        >
          <option value="all">Todos los numeros</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.displayName} · {account.phoneNumber ?? "Sin vincular"}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="p-4 text-sm text-slate-700">{error}</div>
        ) : null}
        {isLoading ? (
          <div className="p-4 text-sm font-semibold text-slate-600">
            Cargando conversaciones...
          </div>
        ) : null}
        {!isLoading && conversations.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">{emptyLabel}</div>
        ) : null}
        {conversations.map((conversation) => {
          const selected = conversation.id === selectedId;
          return (
            <button
              type="button"
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cx(
                "grid w-full gap-2 border-b border-slate-100 p-4 text-left hover:bg-slate-50",
                selected && "bg-slate-100",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">
                    {conversationTitle(conversation)}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {conversation.contact?.phoneNumber ?? "-"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-slate-500">
                    {formatTime(conversation.lastMessageAt)}
                  </span>
                  {conversation.unreadCount > 0 ? (
                    <Badge tone="dark">{conversation.unreadCount}</Badge>
                  ) : null}
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-slate-600">
                {conversation.lastMessage?.body ?? "Sin mensajes"}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge>
                  via {conversation.whatsappAccount?.displayName ?? "Numero"}
                </Badge>
                <span>
                  {accountStatusLabel(
                    conversation.whatsappAccount?.status ?? "pending",
                  )}
                </span>
                <Badge tone={conversation.unreadCount > 0 ? "warn" : "default"}>
                  {conversationStatusLabel(conversation.status)}
                </Badge>
                {conversation.lastMessage?.direction === "bot" ? (
                  <Badge>Bot</Badge>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
