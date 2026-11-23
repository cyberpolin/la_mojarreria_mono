import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { notifyTakuBackend, toBackendEvent } from "./backendWebhook.js";
import type { ParsedFacebookEvent } from "../types.js";

const event: ParsedFacebookEvent = {
  kind: "publication.comment",
  pageId: "111",
  eventId: "comment:c_1",
  commentId: "c_1",
  postId: "111_999",
  parentId: "111_999",
  fromId: "222",
  fromName: "Ana",
  message: "precio",
  createdTime: "2026-01-01T00:00:00.000Z",
};

test("signs the taku-backend payload with the same timestamp contract", async () => {
  const secret = "webhook-secret";
  const captured: { url: string; headers: Headers; body: string } = {
    url: "",
    headers: new Headers(),
    body: "",
  };
  const now = () => new Date("2026-01-01T00:00:00.000Z");

  await notifyTakuBackend({
    config: {
      takuBackendUrl: "http://127.0.0.1:3110",
      takuBackendWebhookSecret: secret,
      takuBackendWebhookPath: "/api/webhooks/facebook",
    },
    event,
    now,
    fetchImpl: async (input, init) => {
      captured.url = String(input);
      captured.headers = new Headers(init?.headers);
      captured.body = String(init?.body);
      return new Response("ok", { status: 200 });
    },
  });

  assert.equal(captured.url, "http://127.0.0.1:3110/api/webhooks/facebook");
  const timestamp = captured.headers.get("x-timestamp");
  const signature = captured.headers.get("x-signature");
  assert.equal(timestamp, "1767225600");
  assert.equal(captured.headers.get("x-fb-service-secret"), secret);
  assert.equal(
    signature,
    createHmac("sha256", secret)
      .update(`${timestamp}.${captured.body}`)
      .digest("hex"),
  );
  assert.deepEqual(
    JSON.parse(captured.body),
    toBackendEvent(event, now().toISOString()),
  );
});
