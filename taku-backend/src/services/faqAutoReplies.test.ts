import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findMatchingFaqAutoReply,
  repliesForWhatsAppAccount,
  wasFaqAutoReplySentToday,
} from "./faqAutoReplies.js";

const conversationId = "conv_1";
const today = new Date().toISOString();
const logs = [
  {
    conversationId,
    reason: "faq_auto_reply:ubicacion",
    createdAt: today,
  },
];

test("same FAQ intent is locked for the day", () => {
  assert.equal(
    wasFaqAutoReplySentToday(logs, conversationId, "ubicacion"),
    true,
  );
});

test("another FAQ intent still answers the same day", () => {
  assert.equal(wasFaqAutoReplySentToday(logs, conversationId, "envio"), false);
});

test("FAQ replies prefer the WhatsApp number over tenant defaults", () => {
  const replies = [
    {
      workspaceId: "ws",
      whatsappAccountId: null,
      intent: "envio",
      phrases: ["envio"],
      responseText: "tenant",
      enabled: true,
      threshold: 50,
    },
    {
      workspaceId: "ws",
      whatsappAccountId: "acc_a",
      intent: "envio",
      phrases: ["envio"],
      responseText: "numero a",
      enabled: true,
      threshold: 50,
    },
  ];
  const scoped = repliesForWhatsAppAccount(replies, "ws", "acc_a");
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0]?.whatsappAccountId, "acc_a");
  const match = findMatchingFaqAutoReply(replies, "ws", "envio", "acc_a");
  assert.equal(match?.responseText, "numero a");
  const other = findMatchingFaqAutoReply(replies, "ws", "envio", "acc_b");
  assert.equal(other?.responseText, "tenant");
});
