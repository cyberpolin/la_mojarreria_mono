import { fetchNewestMessages } from "./api";
import { digitsPhone } from "./helpers";
import type { InboxConversation, InboxMessage } from "./types";

export const PREFETCH_TOP_THREADS = 8;

export type CachedThread = {
  conversation: InboxConversation;
  messages: InboxMessage[];
  hasMore: boolean;
};

const cache = new Map<string, CachedThread>();
const inflight = new Map<string, Promise<CachedThread | null>>();

export function threadCacheKey(phone: string, accountId?: string | null) {
  return `${accountId ?? "any"}:${digitsPhone(phone)}`;
}

function keyForConversation(conversation: InboxConversation) {
  const phone = conversation.contact?.phoneNumber ?? "";
  if (!digitsPhone(phone) && !conversation.id) return null;
  return threadCacheKey(
    phone || conversation.id,
    conversation.whatsappAccount?.id,
  );
}

export function readThreadCache(phone: string, accountId?: string | null) {
  return cache.get(threadCacheKey(phone, accountId)) ?? null;
}

export function writeThreadCache(entry: CachedThread) {
  const key = keyForConversation(entry.conversation);
  if (!key) return;
  cache.set(key, entry);
}

async function loadConversationMessages(conversation: InboxConversation) {
  const key = keyForConversation(conversation);
  if (!key) return null;
  const pending = inflight.get(key);
  if (pending) return pending;

  const task = fetchNewestMessages(conversation.id)
    .then((history) => {
      const entry: CachedThread = {
        conversation,
        messages: history.items,
        hasMore: history.hasMore,
      };
      cache.set(key, entry);
      return entry;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, task);
  return task;
}

export async function prefetchTopThreads(conversations: InboxConversation[]) {
  const top = conversations.slice(0, PREFETCH_TOP_THREADS);
  for (const conversation of top) {
    const key = keyForConversation(conversation);
    if (!key) continue;
    const current = cache.get(key);
    if (
      current &&
      current.conversation.lastMessageAt === conversation.lastMessageAt &&
      current.conversation.id === conversation.id
    ) {
      continue;
    }
    await loadConversationMessages(conversation);
  }
}
