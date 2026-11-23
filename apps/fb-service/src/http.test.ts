import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { AddressInfo } from "node:net";
import pino from "pino";
import type { AppConfig } from "./config.js";
import { createServer } from "./server.js";

const logger = pino({ level: "silent" });

function testConfig(root: string): AppConfig {
  return {
    port: 0,
    serviceApiKey: "local-test-key",
    facebookVerifyToken: "verify-token",
    facebookAppSecret: "app-secret",
    facebookSkipSignatureCheck: false,
    graphApiVersion: "v21.0",
    replyMode: "local",
    takuBackendUrl: null,
    takuBackendWebhookSecret: null,
    takuBackendWebhookPath: "/api/webhooks/facebook",
    pagesFile: join(root, "pages.json"),
    publicationRulesFile: join(root, "rules.json"),
    processedEventsFile: join(root, "processed.json"),
    eventLogFile: join(root, "events.json"),
    logLevel: "silent",
  };
}

async function listen(config: AppConfig): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const app = createServer({ config, logger });
  const server = createHttpServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not bind a port");
  }

  return {
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

test("verifies the Meta webhook and stores a publication rule", async () => {
  const root = await mkdtemp(join(tmpdir(), "fb-service-"));
  const running = await listen(testConfig(root));

  try {
    const health = await fetch(`${running.baseUrl}/health`);
    assert.equal(health.status, 200);
    const healthBody = (await health.json()) as { service: string };
    assert.equal(healthBody.service, "fb-service");

    const challenge = await fetch(
      `${running.baseUrl}/webhooks/facebook?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge-123`,
    );
    assert.equal(challenge.status, 200);
    assert.equal(await challenge.text(), "challenge-123");

    const rejected = await fetch(
      `${running.baseUrl}/webhooks/facebook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=nope`,
    );
    assert.equal(rejected.status, 403);

    const missingKey = await fetch(`${running.baseUrl}/v1/publication-rules`);
    assert.equal(missingKey.status, 401);

    const created = await fetch(`${running.baseUrl}/v1/publication-rules`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "local-test-key",
      },
      body: JSON.stringify({
        pageId: "123456",
        postIds: ["123456_789"],
        keywords: ["Precio"],
        replyText: "Te pasamos el precio por Messenger.",
      }),
    });
    assert.equal(created.status, 201);
    const createdBody = (await created.json()) as {
      rule: { keywords: string[]; postIds: string[] };
    };
    assert.deepEqual(createdBody.rule.keywords, ["precio"]);
    assert.deepEqual(createdBody.rule.postIds, ["123456_789"]);

    const saved = await fetch(`${running.baseUrl}/v1/pages/123456`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-api-key": "local-test-key",
      },
      body: JSON.stringify({
        label: "TAKU",
        accessToken: "page-token",
        messengerEnabled: true,
        messengerReplyText: "Hola",
      }),
    });
    assert.equal(saved.status, 200);
    const savedBody = (await saved.json()) as {
      page: { accessToken?: string; accessTokenConfigured: boolean };
    };
    assert.equal(savedBody.page.accessToken, undefined);
    assert.equal(savedBody.page.accessTokenConfigured, true);
  } finally {
    await running.close();
    await rm(root, { recursive: true, force: true });
  }
});
