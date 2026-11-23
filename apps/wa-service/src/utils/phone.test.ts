import assert from "node:assert/strict";
import { test } from "node:test";
import { directChatPhone, firstDirectChatPhone } from "./phone.js";

test("direct chats normalize mexican numbers and device suffixes", () => {
  assert.equal(directChatPhone("9931234567"), "5219931234567");
  assert.equal(directChatPhone("529931234567"), "5219931234567");
  assert.equal(
    directChatPhone("5219931234567:0@s.whatsapp.net"),
    "5219931234567",
  );
  assert.equal(directChatPhone("1203630@g.us"), null);
  assert.equal(directChatPhone("15551212@lid"), null);
});

test("a phone id wins over a lid id", () => {
  assert.equal(
    firstDirectChatPhone("15551212@lid", "529931234567@s.whatsapp.net"),
    "5219931234567",
  );
});
