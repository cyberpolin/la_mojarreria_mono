"use client";

import type { TakuChat } from "./types";

function formatTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ChatListItem({
  chat,
  active,
  onSelect,
}: {
  chat: TakuChat;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid min-h-[72px] w-full grid-cols-[44px_1fr] gap-3 border-b border-slate-900 px-4 py-3 text-left hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-slate-400 ${
        active ? "bg-slate-900" : ""
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-200">
        {chat.name.replace("+", "").slice(0, 2)}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-sm font-medium text-slate-100">
            {chat.name}
          </p>
          <span className="shrink-0 text-[11px] text-slate-500">
            {formatTime(chat.lastMessageAt)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-slate-400">
            {chat.lastMessage?.fromMe ? "Tu: " : ""}
            {chat.lastMessage?.body || "Media message"}
          </p>
          {chat.unreadCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-950">
              {chat.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
