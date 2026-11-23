import assert from "node:assert/strict";
import { test } from "node:test";
import type { Contact, Conversation, Database, Message } from "../types.js";
import {
  canonicalDirectPhone,
  mergeDuplicateDirectContacts,
} from "./contactPhones.js";

function contact(
  overrides: Partial<Contact> & Pick<Contact, "id" | "phoneNumber">,
): Contact {
  return {
    workspaceId: "ws",
    name: null,
    profilePictureUrl: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function conversation(
  overrides: Partial<Conversation> & Pick<Conversation, "id" | "contactId">,
): Conversation {
  return {
    workspaceId: "ws",
    whatsappAccountId: "wa",
    status: "open",
    lastMessageBody: null,
    lastMessageAt: null,
    assignedUserId: null,
    unreadCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function message(
  overrides: Partial<Message> &
    Pick<Message, "id" | "conversationId" | "contactId">,
): Message {
  return {
    workspaceId: "ws",
    whatsappAccountId: "wa",
    externalMessageId: null,
    direction: "inbound",
    type: "text",
    body: "hola",
    mediaUrl: null,
    mediaMimeType: null,
    mediaFilename: null,
    status: "received",
    sentByUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function database(parts: {
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
}): Database {
  return {
    contacts: parts.contacts,
    conversations: parts.conversations,
    messages: parts.messages,
    automationDecisionLogs: [],
  } as unknown as Database;
}

test("mexican mobile numbers share one canonical form", () => {
  assert.equal(canonicalDirectPhone("9931234567"), "5219931234567");
  assert.equal(canonicalDirectPhone("529931234567"), "5219931234567");
  assert.equal(canonicalDirectPhone("5219931234567"), "5219931234567");
  assert.equal(
    canonicalDirectPhone("5219931234567:0@s.whatsapp.net"),
    "5219931234567",
  );
  assert.equal(canonicalDirectPhone("1203630@g.us"), null);
});

test("duplicate direct chats collapse to one contact and one conversation", () => {
  const stored = database({
    contacts: [
      contact({
        id: "contact-old",
        phoneNumber: "5219931234567",
        name: "Ana",
      }),
      contact({
        id: "contact-new",
        phoneNumber: "529931234567",
        name: "Ana",
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
    ],
    conversations: [
      conversation({
        id: "conv-old",
        contactId: "contact-old",
        lastMessageAt: "2026-01-02T00:00:00.000Z",
        lastMessageBody: "antes",
      }),
      conversation({
        id: "conv-new",
        contactId: "contact-new",
        lastMessageAt: "2026-02-02T00:00:00.000Z",
        lastMessageBody: "ahora",
        unreadCount: 1,
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
    ],
    messages: [
      message({
        id: "msg-old",
        conversationId: "conv-old",
        contactId: "contact-old",
        body: "antes",
        externalMessageId: "wamid-old",
      }),
      message({
        id: "msg-new",
        conversationId: "conv-new",
        contactId: "contact-new",
        body: "ahora",
        externalMessageId: "wamid-new",
        createdAt: "2026-02-02T00:00:00.000Z",
      }),
    ],
  });

  assert.equal(mergeDuplicateDirectContacts(stored), true);
  assert.equal(stored.contacts.length, 1);
  assert.equal(stored.contacts[0]?.phoneNumber, "5219931234567");
  assert.equal(stored.contacts[0]?.name, "Ana");
  assert.equal(stored.conversations.length, 1);
  assert.equal(stored.conversations[0]?.id, "conv-new");
  assert.equal(stored.conversations[0]?.unreadCount, 1);
  assert.deepEqual(stored.messages.map((item) => item.conversationId).sort(), [
    "conv-new",
    "conv-new",
  ]);
  assert.equal(mergeDuplicateDirectContacts(stored), false);
});

test("the same inbound message is kept once", () => {
  const stored = database({
    contacts: [
      contact({ id: "contact-a", phoneNumber: "5219931234567", name: "Ana" }),
      contact({ id: "contact-b", phoneNumber: "9931234567" }),
    ],
    conversations: [
      conversation({ id: "conv-a", contactId: "contact-a", unreadCount: 1 }),
      conversation({
        id: "conv-b",
        contactId: "contact-b",
        unreadCount: 1,
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    ],
    messages: [
      message({
        id: "msg-a",
        conversationId: "conv-a",
        contactId: "contact-a",
        body: "ya voy",
        externalMessageId: "same-id",
        createdAt: "2026-03-02T00:00:00.000Z",
      }),
      message({
        id: "msg-b",
        conversationId: "conv-b",
        contactId: "contact-b",
        body: "ya voy",
        externalMessageId: "same-id",
        createdAt: "2026-03-02T00:00:01.000Z",
      }),
    ],
  });

  mergeDuplicateDirectContacts(stored);
  assert.equal(stored.messages.length, 1);
  assert.equal(stored.conversations.length, 1);
});

test("group chats stay separate", () => {
  const stored = database({
    contacts: [
      contact({
        id: "group",
        phoneNumber: "1203630@g.us",
        kind: "group",
        name: "Repartidores",
      }),
    ],
    conversations: [conversation({ id: "group-conv", contactId: "group" })],
    messages: [],
  });

  assert.equal(mergeDuplicateDirectContacts(stored), false);
  assert.equal(stored.contacts.length, 1);
  assert.equal(stored.conversations.length, 1);
});
