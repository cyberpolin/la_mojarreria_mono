import type { Contact, Conversation, Database, Message } from "../types.js";

export function canonicalDirectPhone(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase().endsWith("@g.us")) return null;
  if (trimmed.toLowerCase().endsWith("@lid")) return null;
  const user = trimmed.split("@")[0]?.split(":")[0] ?? "";
  const digits = user.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  if (digits.length === 10) return `521${digits}`;
  if (
    digits.startsWith("52") &&
    !digits.startsWith("521") &&
    digits.length === 12
  ) {
    return `521${digits.slice(2)}`;
  }
  return digits;
}

export function directPhonesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const canonicalLeft = canonicalDirectPhone(left);
  const canonicalRight = canonicalDirectPhone(right);
  if (canonicalLeft && canonicalRight) return canonicalLeft === canonicalRight;
  const digitsLeft = (left ?? "").replace(/\D/g, "");
  const digitsRight = (right ?? "").replace(/\D/g, "");
  return Boolean(digitsLeft) && digitsLeft === digitsRight;
}

function isDirectContact(contact: Contact) {
  if (contact.kind === "group") return false;
  if (contact.phoneNumber.trim().toLowerCase().endsWith("@g.us")) return false;
  return canonicalDirectPhone(contact.phoneNumber) !== null;
}

function later(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const a = left ?? "";
  const b = right ?? "";
  if (!a) return right ?? null;
  if (!b) return left ?? null;
  return a >= b ? (left ?? null) : (right ?? null);
}

function fillContact(primary: Contact, extra: Contact) {
  let changed = false;
  if (!primary.name && extra.name) {
    primary.name = extra.name;
    changed = true;
  }
  if (!primary.profilePictureUrl && extra.profilePictureUrl) {
    primary.profilePictureUrl = extra.profilePictureUrl;
    changed = true;
  }
  if (!primary.notes && extra.notes) {
    primary.notes = extra.notes;
    changed = true;
  }
  return changed;
}

function sameInboundBurst(left: Message, right: Message) {
  if (left.direction !== "inbound" || right.direction !== "inbound") {
    return false;
  }
  if ((left.body ?? "").trim() !== (right.body ?? "").trim()) return false;
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return false;
  return Math.abs(leftTime - rightTime) <= 15_000;
}

function conversationStamp(conversation: Conversation) {
  return (
    conversation.lastMessageAt ??
    conversation.updatedAt ??
    conversation.createdAt
  );
}

export function mergeDuplicateDirectContacts(database: Database) {
  let changed = false;
  const grouped = new Map<string, Contact[]>();

  for (const contact of database.contacts) {
    if (!isDirectContact(contact)) continue;
    const phone = canonicalDirectPhone(contact.phoneNumber);
    if (!phone) continue;
    const key = `${contact.workspaceId}\0${phone}`;
    const items = grouped.get(key) ?? [];
    items.push(contact);
    grouped.set(key, items);
  }

  const removedContactIds = new Set<string>();

  for (const [key, contacts] of grouped) {
    const phone = key.slice(key.indexOf("\0") + 1);
    const primary = [...contacts].sort((left, right) => {
      const leftExact = left.phoneNumber === phone ? 0 : 1;
      const rightExact = right.phoneNumber === phone ? 0 : 1;
      if (leftExact !== rightExact) return leftExact - rightExact;
      return left.createdAt.localeCompare(right.createdAt);
    })[0];
    if (!primary) continue;

    if (primary.phoneNumber !== phone) {
      primary.phoneNumber = phone;
      changed = true;
    }

    for (const extra of contacts) {
      if (extra.id === primary.id) continue;
      changed = fillContact(primary, extra) || changed;
      for (const conversation of database.conversations) {
        if (conversation.contactId === extra.id) {
          conversation.contactId = primary.id;
          changed = true;
        }
      }
      for (const message of database.messages) {
        if (message.contactId === extra.id) {
          message.contactId = primary.id;
          changed = true;
        }
      }
      removedContactIds.add(extra.id);
      changed = true;
    }
  }

  if (removedContactIds.size > 0) {
    database.contacts = database.contacts.filter(
      (contact) => !removedContactIds.has(contact.id),
    );
  }

  const conversationsByPhone = new Map<string, Conversation[]>();
  const contactById = new Map(
    database.contacts.map((contact) => [contact.id, contact]),
  );
  for (const conversation of database.conversations) {
    const contact = contactById.get(conversation.contactId);
    if (!contact || !isDirectContact(contact)) continue;
    const phone = canonicalDirectPhone(contact.phoneNumber);
    if (!phone) continue;
    const groupKey = `${conversation.workspaceId}:${conversation.whatsappAccountId}:${phone}`;
    const items = conversationsByPhone.get(groupKey) ?? [];
    items.push(conversation);
    conversationsByPhone.set(groupKey, items);
  }

  const removedConversationIds = new Set<string>();
  const removedMessageIds = new Set<string>();

  for (const conversations of conversationsByPhone.values()) {
    if (conversations.length < 2) continue;
    const survivor = [...conversations].sort((left, right) => {
      const byStamp = conversationStamp(right).localeCompare(
        conversationStamp(left),
      );
      if (byStamp !== 0) return byStamp;
      return left.createdAt.localeCompare(right.createdAt);
    })[0];
    if (!survivor) continue;

    for (const loser of conversations) {
      if (loser.id === survivor.id) continue;
      const kept = database.messages.filter(
        (message) =>
          message.conversationId === survivor.id &&
          !removedMessageIds.has(message.id),
      );
      let movedInbound = 0;
      for (const message of database.messages) {
        if (message.conversationId !== loser.id) continue;
        const duplicate =
          (message.externalMessageId &&
            kept.some(
              (existing) =>
                existing.externalMessageId === message.externalMessageId &&
                existing.direction === message.direction,
            )) ||
          kept.some((existing) => sameInboundBurst(existing, message));
        if (duplicate) {
          removedMessageIds.add(message.id);
          continue;
        }
        message.conversationId = survivor.id;
        message.contactId = survivor.contactId;
        kept.push(message);
        if (message.direction === "inbound") movedInbound += 1;
      }
      for (const log of database.automationDecisionLogs ?? []) {
        if (log.conversationId === loser.id) log.conversationId = survivor.id;
      }
      if (movedInbound > 0) survivor.unreadCount += loser.unreadCount;
      survivor.pinned = Boolean(survivor.pinned || loser.pinned);
      survivor.assignedUserId = survivor.assignedUserId ?? loser.assignedUserId;
      const loserStamp = loser.lastMessageAt ?? "";
      const survivorStamp = survivor.lastMessageAt ?? "";
      if (loserStamp > survivorStamp) {
        survivor.lastMessageAt = loser.lastMessageAt;
        survivor.lastMessageBody = loser.lastMessageBody;
      } else {
        survivor.lastMessageAt = later(
          survivor.lastMessageAt,
          loser.lastMessageAt,
        );
      }
      removedConversationIds.add(loser.id);
      changed = true;
    }
  }

  if (removedConversationIds.size > 0) {
    database.conversations = database.conversations.filter(
      (conversation) => !removedConversationIds.has(conversation.id),
    );
  }

  const seenInbound = new Set<string>();
  const ordered = [...database.messages].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  for (const message of ordered) {
    if (removedMessageIds.has(message.id)) continue;
    if (message.direction !== "inbound" || !message.externalMessageId) continue;
    const identity = `${message.workspaceId}:${message.externalMessageId}`;
    if (seenInbound.has(identity)) {
      removedMessageIds.add(message.id);
      continue;
    }
    seenInbound.add(identity);
  }

  if (removedMessageIds.size > 0) {
    database.messages = database.messages.filter(
      (message) => !removedMessageIds.has(message.id),
    );
    changed = true;
  }

  return changed;
}
