import pino from "pino";
import { config } from "./config.js";
import { recordDebugLog } from "./debugLogStore.js";
import { createBotServer } from "./server.js";

const logger = pino({
  redact: ["req.headers.x-api-key", "apiKey"],
});

const server = createBotServer(config, logger);

server.listen(config.port, config.host, () => {
  logger.info(
    { host: config.host, port: config.port },
    "bot service listening",
  );
  recordDebugLog({
    event: "bot-service debug logger started",
    data: { host: config.host, port: config.port },
  });
});

const heartbeatInterval = setInterval(() => {
  logger.info(
    { host: config.host, port: config.port },
    "bot-service heartbeat test",
  );
  recordDebugLog({
    event: "bot-service heartbeat test",
    data: { host: config.host, port: config.port },
  });
}, 60_000);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "shutting down bot service");
  clearInterval(heartbeatInterval);

  server.close((error?: Error) => {
    if (error) {
      logger.error({ err: error }, "bot service shutdown failed");
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", (signal) => {
  void shutdown(signal);
});

process.on("SIGTERM", (signal) => {
  void shutdown(signal);
});
