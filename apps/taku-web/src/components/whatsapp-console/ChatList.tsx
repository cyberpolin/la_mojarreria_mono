"use client";

import type { TakuChat } from "./types";
import { ChatListItem } from "./ChatListItem";
import { SearchBox } from "./SearchBox";

export function ChatList({
  chats,
  activeChatId,
  query,
  loading,
  onQueryChange,
  onSelectChat,
}: {
  chats: TakuChat[];
  activeChatId: string | null;
  query: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col border-b border-slate-800 bg-slate-950 lg:border-b-0 lg:border-r">
      <div className="border-b border-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Chats</h2>
            <p className="text-xs text-slate-500">{chats.length} visibles</p>
          </div>
          {loading ? (
            <span className="rounded-md border border-slate-800 px-2 py-1 text-[11px] text-slate-400">
              Sync
            </span>
          ) : null}
        </div>
        <SearchBox value={query} onChange={onQueryChange} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">
            No hay chats para mostrar.
          </div>
        ) : (
          chats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              active={chat.id === activeChatId}
              onSelect={() => onSelectChat(chat.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
