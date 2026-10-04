"use client";

import { useEffect, useMemo, useState } from "react";
import { lastInboundFaqSignal } from "./faqSemaforo";
import { loadConversationMessages } from "./threadCache";
import type { InboxConversation } from "./types";

const MAX_UNREAD_TO_SCAN = 25;

export function useUnreadFaqLights(conversations: InboxConversation[]) {
  const [litIds, setLitIds] = useState<Set<string>>(() => new Set());
  const unread = useMemo(
    () =>
      conversations
        .filter((conversation) => conversation.unreadCount > 0)
        .slice(0, MAX_UNREAD_TO_SCAN),
    [conversations],
  );
  const unreadKey = unread
    .map(
      (conversation) =>
        `${conversation.id}:${conversation.lastMessageAt ?? ""}:${conversation.unreadCount}`,
    )
    .join("|");

  useEffect(() => {
    if (!unreadKey) {
      setLitIds(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = new Set<string>();
      for (const conversation of unread) {
        const thread = await loadConversationMessages(conversation);
        if (cancelled) return;
        if (thread && lastInboundFaqSignal(thread.messages)?.match) {
          next.add(conversation.id);
        }
      }
      if (!cancelled) setLitIds(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [unread, unreadKey]);

  return litIds;
}
