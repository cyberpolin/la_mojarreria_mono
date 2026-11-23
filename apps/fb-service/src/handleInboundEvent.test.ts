import assert from "node:assert/strict";
import test from "node:test";
import { handleInboundEvent, type InboundDeps } from "./handleInboundEvent.js";
import type {
  PageRecord,
  ParsedFacebookEvent,
  PublicationRule,
} from "./types.js";

const page: PageRecord = {
  pageId: "111",
  label: "TAKU",
  accessToken: "page-token",
  messengerEnabled: true,
  messengerReplyText: "Te escribimos pronto",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const rule: PublicationRule = {
  id: "rule-1",
  pageId: "111",
  enabled: true,
  matchAllPosts: false,
  postIds: ["111_999"],
  keywords: [],
  replyText: "Gracias por escribir",
  topLevelOnly: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const comment: ParsedFacebookEvent = {
  kind: "publication.comment",
  pageId: "111",
  eventId: "comment:c_1",
  commentId: "c_1",
  postId: "111_999",
  parentId: "111_999",
  fromId: "222",
  fromName: "Ana",
  message: "hola",
  createdTime: null,
};

function deps(overrides: Partial<InboundDeps> = {}): InboundDeps & {
  replies: string[];
  forwarded: string[];
} {
  const replies: string[] = [];
  const forwarded: string[] = [];
  return {
    replyMode: "local",
    pages: [page],
    rules: [rule],
    replies,
    forwarded,
    claim: async () => true,
    release: async () => undefined,
    sendMessenger: async (input) => {
      replies.push(input.text);
    },
    sendCommentReply: async (input) => {
      replies.push(input.text);
    },
    forwardToBackend: async (event) => {
      forwarded.push(event.eventId);
    },
    ...overrides,
  };
}

test("replies only to a configured publication in local mode", async () => {
  const local = deps();
  const result = await handleInboundEvent(comment, local);
  const otherPost = await handleInboundEvent(
    {
      ...comment,
      eventId: "comment:c_2",
      commentId: "c_2",
      postId: "111_1000",
    },
    local,
  );

  assert.equal(result.outcome, "replied");
  assert.deepEqual(local.replies, ["Gracias por escribir"]);
  assert.equal(otherPost.outcome, "no_rule");
  assert.equal(local.forwarded.length, 0);
});

test("does not answer a comment written by the page", async () => {
  const local = deps();
  const result = await handleInboundEvent({ ...comment, fromId: "111" }, local);

  assert.equal(result.outcome, "ignored");
  assert.equal(result.detail, "page_authored");
  assert.deepEqual(local.replies, []);
});

test("forwards messenger and comments without replying in backend mode", async () => {
  const backend = deps({ replyMode: "backend" });
  const message: ParsedFacebookEvent = {
    kind: "messenger.message",
    pageId: "111",
    eventId: "messenger:m_1",
    senderId: "222",
    messageId: "m_1",
    text: "hola",
    timestamp: "2026-01-01T00:00:00.000Z",
  };

  const commentResult = await handleInboundEvent(comment, backend);
  const messageResult = await handleInboundEvent(message, backend);

  assert.equal(commentResult.outcome, "forwarded");
  assert.equal(messageResult.outcome, "forwarded");
  assert.deepEqual(backend.forwarded, ["comment:c_1", "messenger:m_1"]);
  assert.deepEqual(backend.replies, []);
});

test("answers a messenger thread from the page reply text", async () => {
  const local = deps();
  const result = await handleInboundEvent(
    {
      kind: "messenger.message",
      pageId: "111",
      eventId: "messenger:m_1",
      senderId: "222",
      messageId: "m_1",
      text: "hola",
      timestamp: "2026-01-01T00:00:00.000Z",
    },
    local,
  );

  assert.equal(result.outcome, "replied");
  assert.deepEqual(local.replies, ["Te escribimos pronto"]);
});
