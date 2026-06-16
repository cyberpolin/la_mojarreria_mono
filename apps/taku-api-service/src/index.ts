import { config } from "./config.js";
import { logger } from "./logger.js";
import { createServer } from "./server.js";

const app = createServer({ config, logger });
const server = app.listen(config.port, config.host, () => {
  logger.info(
    { host: config.host, port: config.port },
    "TAKU API service listening",
  );
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "shutting down TAKU API service");
  server.close((error?: Error) => {
    if (error) {
      logger.error({ err: error }, "TAKU API service shutdown failed");
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
