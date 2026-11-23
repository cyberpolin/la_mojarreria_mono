import assert from "node:assert/strict";
import test from "node:test";
import { parseFacebookWebhook } from "./parseWebhook.js";

test("parses messenger text and new publication comments", () => {
  const events = parseFacebookWebhook({
    object: "page",
    entry: [
      {
        id: "111",
        messaging: [
          {
            sender: { id: "222" },
            recipient: { id: "111" },
            timestamp: 1_700_000_000_000,
            message: { mid: "m_1", text: " Hola " },
          },
          {
            sender: { id: "111" },
            message: { mid: "m_echo", text: "echo", is_echo: true },
          },
        ],
        changes: [
          {
            field: "feed",
            value: {
              item: "comment",
              verb: "add",
              comment_id: "c_1",
              post_id: "111_999",
              parent_id: "111_999",
              message: " precio? ",
              from: { id: "333", name: "Ana" },
              created_time: 1_700_000_100,
            },
          },
          {
            field: "feed",
            value: {
              item: "comment",
              verb: "edited",
              comment_id: "c_2",
              post_id: "111_999",
              message: "edited",
            },
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    events.map((event) => event.eventId),
    ["messenger:m_1", "comment:c_1"],
  );
  assert.equal(events[0]?.kind, "messenger.message");
  if (events[0]?.kind === "messenger.message") {
    assert.equal(events[0].text, "Hola");
    assert.equal(events[0].senderId, "222");
  }
  assert.equal(events[1]?.kind, "publication.comment");
  if (events[1]?.kind === "publication.comment") {
    assert.equal(events[1].postId, "111_999");
    assert.equal(events[1].message, "precio?");
    assert.equal(events[1].fromName, "Ana");
  }
});

test("ignores payloads that are not a Facebook page webhook", () => {
  assert.deepEqual(parseFacebookWebhook({ object: "instagram" }), []);
  assert.deepEqual(parseFacebookWebhook(null), []);
});
