import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyMetaSignature } from "./signature.js";

test("accepts a Meta sha256 signature of the raw body", () => {
  const body = Buffer.from('{"object":"page"}');
  const secret = "app-secret";
  const digest = createHmac("sha256", secret).update(body).digest("hex");

  assert.equal(verifyMetaSignature(body, `sha256=${digest}`, secret), true);
});

test("rejects a missing or mismatched Meta signature", () => {
  const body = Buffer.from('{"object":"page"}');

  assert.equal(verifyMetaSignature(body, undefined, "app-secret"), false);
  assert.equal(verifyMetaSignature(body, "sha256=abcdef", "app-secret"), false);
});
