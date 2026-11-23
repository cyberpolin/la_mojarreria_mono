import assert from "node:assert/strict";
import test from "node:test";
import { isDriversTestChat, sameLocalPhone } from "./helpers";
import type { InboxConversation } from "./types";

function chat(phone: string, group = false): InboxConversation {
  return {
    id: "conversation",
    status: "open",
    unreadCount: 0,
    isGroup: group,
    contact: {
      id: "contact",
      phoneNumber: phone,
      name: group ? "Pruebas" : "Carlos",
      kind: group ? "group" : "direct",
    },
  } as InboxConversation;
}

test("matches the test phone with or without the country code", () => {
  assert.equal(sameLocalPhone("5219931175435", "9931175435"), true);
  assert.equal(sameLocalPhone("5219931175435", "5219930000000"), false);
});

test("the test destination chat is a direct conversation", () => {
  assert.equal(isDriversTestChat(chat("5219931175435"), "9931175435"), true);
  assert.equal(
    isDriversTestChat(chat("5219931175435@g.us", true), "5219931175435"),
    false,
  );
  assert.equal(
    isDriversTestChat(chat("5219930000000"), "5219931175435"),
    false,
  );
});
