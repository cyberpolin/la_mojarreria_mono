"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { lastInboundFaqSignal, lastMessageLooksLikeFaq } from "./faqSemaforo";
import { loadConversationMessages, readThreadCache } from "./threadCache";
import type { InboxConversation } from "./types";

const MAX_UNREAD_TO_SCAN = 25;

function initialFaqLights(conversations: InboxConversation[]) {
  return new Set(
    conversations
      .filter(lastMessageLooksLikeFaq)
      .map((conversation) => conversation.id),
  );
}

export function useUnreadFaqLights(conversations: InboxConversation[]) {
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
  const unreadRef = useRef(unread);
  unreadRef.current = unread;

  const [litIds, setLitIds] = useState<Set<string>>(() =>
    initialFaqLights(unread),
  );

  useEffect(() => {
    const rows = unreadRef.current;
    setLitIds(initialFaqLights(rows));
    if (!unreadKey) return;

    let cancelled = false;
    void (async () => {
      const next = new Set<string>();
      for (const conversation of rows) {
        const cached = conversation.contact?.phoneNumber
          ? readThreadCache(
              conversation.contact.phoneNumber,
              conversation.whatsappAccount?.id,
            )
          : null;
        const thread =
          cached && cached.conversation.id === conversation.id
            ? cached
            : await loadConversationMessages(conversation);
        if (cancelled) return;
        if (thread && lastInboundFaqSignal(thread.messages)?.match) {
          next.add(conversation.id);
          continue;
        }
        if (!thread && lastMessageLooksLikeFaq(conversation)) {
          next.add(conversation.id);
        }
      }
      if (!cancelled) setLitIds(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [unreadKey]);

  return litIds;
}
