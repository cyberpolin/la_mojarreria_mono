import { config } from "./config.js";
import { logger } from "./logger.js";
import { createServer } from "./server.js";

const app = createServer({ config, logger });
const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      replyMode: config.replyMode,
      backendConfigured: Boolean(
        config.takuBackendUrl && config.takuBackendWebhookSecret,
      ),
    },
    "facebook service listening",
  );
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, "shutting down facebook service");
  server.close((error?: Error) => {
    if (error) {
      logger.error({ err: error.message }, "facebook service shutdown failed");
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
