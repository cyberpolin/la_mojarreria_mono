import { readObject, readString, toIsoTimestamp } from "../text.js";
import type { ParsedFacebookEvent } from "../types.js";

function readId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return readString(value);
}

export function parseFacebookWebhook(body: unknown): ParsedFacebookEvent[] {
  const payload = readObject(body);
  if (!payload || payload.object !== "page" || !Array.isArray(payload.entry)) {
    return [];
  }

  const events: ParsedFacebookEvent[] = [];
  for (const entryValue of payload.entry) {
    const entry = readObject(entryValue);
    const pageId = entry ? readId(entry.id) : null;
    if (!entry || !pageId) {
      continue;
    }

    if (Array.isArray(entry.messaging)) {
      for (const messagingValue of entry.messaging) {
        const event = parseMessengerEvent(pageId, messagingValue);
        if (event) {
          events.push(event);
        }
      }
    }

    if (Array.isArray(entry.changes)) {
      for (const changeValue of entry.changes) {
        const event = parseCommentEvent(pageId, changeValue);
        if (event) {
          events.push(event);
        }
      }
    }
  }

  return events;
}

function parseMessengerEvent(
  pageId: string,
  value: unknown,
): ParsedFacebookEvent | null {
  const messaging = readObject(value);
  const message = messaging ? readObject(messaging.message) : null;
  const sender = messaging ? readObject(messaging.sender) : null;
  if (!messaging || !message || !sender || message.is_echo === true) {
    return null;
  }

  const senderId = readId(sender.id);
  const messageId = readString(message.mid);
  const text = readString(message.text);
  if (!senderId || !messageId || !text || senderId === pageId) {
    return null;
  }

  return {
    kind: "messenger.message",
    pageId,
    eventId: `messenger:${messageId}`,
    senderId,
    messageId,
    text,
    timestamp: toIsoTimestamp(messaging.timestamp) ?? new Date(0).toISOString(),
  };
}

function parseCommentEvent(
  pageId: string,
  value: unknown,
): ParsedFacebookEvent | null {
  const change = readObject(value);
  const changeValue = change ? readObject(change.value) : null;
  if (!change || !changeValue || change.field !== "feed") {
    return null;
  }

  if (changeValue.item !== "comment" || changeValue.verb !== "add") {
    return null;
  }

  const commentId = readId(changeValue.comment_id) ?? readId(changeValue.id);
  const post = readObject(changeValue.post);
  const postId = readId(changeValue.post_id) ?? (post ? readId(post.id) : null);
  const message = readString(changeValue.message);
  if (!commentId || !postId || !message) {
    return null;
  }

  const from = readObject(changeValue.from);
  return {
    kind: "publication.comment",
    pageId,
    eventId: `comment:${commentId}`,
    commentId,
    postId,
    parentId: readId(changeValue.parent_id),
    fromId: from ? readId(from.id) : null,
    fromName: from ? readString(from.name) : null,
    message,
    createdTime: toIsoTimestamp(changeValue.created_time),
  };
}
