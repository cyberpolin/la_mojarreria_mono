import pino from "pino";
import { config } from "./config.js";
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
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "shutting down bot service");

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
