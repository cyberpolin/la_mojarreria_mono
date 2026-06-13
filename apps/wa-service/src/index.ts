import { createServer } from "./server.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { WhatsAppClient } from "./baileys/client.js";
import { notifyWaServiceStatusChanged } from "./services/backendWebhook.js";
import { recordDebugLog } from "./services/debugLogStore.js";
import { getAuthHealth, isAuthSessionMissing } from "./services/authHealth.js";
import {
  isSessionIssueMessage,
  recordSessionIssue,
} from "./services/sessionIssueStore.js";

const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const message = args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");

  if (isSessionIssueMessage(message)) {
    recordSessionIssue({
      reason: "console_error",
      message,
    });
  }

  originalConsoleError(...args);
};

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

await whatsAppClient.connect("startup");
if (config.waServiceAutoStart) {
  await whatsAppClient.start("startup_autoresponse_active");
} else {
  logger.info(
    { autoStart: false },
    "WhatsApp service auto-response disabled; Baileys socket remains connected",
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

  void getAuthHealth(config.whatsappAuthDir)
    .then((auth) => {
      if (!isAuthSessionMissing(auth)) {
        return;
      }

      logger.warn({ auth, status }, "WhatsApp auth session appears missing");
      recordDebugLog({
        level: "warn",
        event: "WhatsApp auth session appears missing",
        data: { auth, status },
      });
    })
    .catch((error: unknown) => {
      logger.warn(
        { err: error, authDir: config.whatsappAuthDir, status },
        "failed to inspect WhatsApp auth session",
      );
      recordDebugLog({
        level: "warn",
        event: "failed to inspect WhatsApp auth session",
        data: {
          authDir: config.whatsappAuthDir,
          status,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    });
}, 60_000);

let shutdownStarted = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  logger.info({ signal }, "shutting down WhatsApp adapter service");
  clearInterval(heartbeatInterval);

  server.close((error?: Error) => {
    if (error) {
      logger.error({ err: error }, "HTTP server shutdown failed");
      process.exitCode = 1;
    }
  });

  await whatsAppClient.shutdown();
  process.exit(0);
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
