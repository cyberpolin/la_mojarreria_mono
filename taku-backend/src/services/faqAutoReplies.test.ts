import assert from "node:assert/strict";
import { test } from "node:test";
import { wasFaqAutoReplySentToday } from "./faqAutoReplies.js";

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
