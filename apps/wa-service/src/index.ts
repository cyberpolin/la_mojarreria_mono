import { createServer } from "./server.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { WhatsAppClient } from "./baileys/client.js";
import { notifyWaServiceStatusChanged } from "./services/backendWebhook.js";
import { recordDebugLog } from "./services/debugLogStore.js";

const whatsAppClient = new WhatsAppClient(config, logger);
logger.info(
  {
    whatsappAuthDir: config.whatsappAuthDir,
    conversationStoreFile: config.conversationStoreFile,
    autoresponseTestPhonesFile: config.autoresponseTestPhonesFile,
  },
  "resolved wa-service runtime paths",
);
whatsAppClient.setStatusChangeHandler((status, reason) =>
  notifyWaServiceStatusChanged(config, logger, {
    service: "wa-service",
    instanceId: "default",
    active: status.active,
    connected: status.connected,
    connection: status.connection,
    hasQr: status.hasQr,
    state: status.state,
    reason,
    changedAt: status.lastChangedAt,
  }),
);

if (config.waServiceAutoStart) {
  await whatsAppClient.start("startup");
} else {
  logger.info(
    { autoStart: false },
    "WhatsApp service auto-start disabled; waiting for manual activation",
  );
}

const app = createServer({ config, logger, whatsAppClient });
const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "WhatsApp adapter service listening");
  recordDebugLog({
    event: "wa-service debug logger started",
    data: { port: config.port },
  });
});

const heartbeatInterval = setInterval(() => {
  const status = whatsAppClient.getStatus();
  logger.info({ status }, "wa-service heartbeat test");
  recordDebugLog({
    event: "wa-service heartbeat test",
    data: {
      active: status.active,
      connected: status.connected,
      connection: status.connection,
      state: status.state,
    },
  });
}, 5_000);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "shutting down WhatsApp adapter service");
  clearInterval(heartbeatInterval);

  server.close((error?: Error) => {
    if (error) {
      logger.error({ err: error }, "HTTP server shutdown failed");
      process.exitCode = 1;
    }
  });

  await whatsAppClient.stop();
  process.exit();
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
