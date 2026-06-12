import pino from "pino";
import {
  isSessionIssueMessage,
  recordSessionIssue,
} from "./services/sessionIssueStore.js";
import {
  getPhoneFromBaileysAttrs,
  recordReceivedMessageLog,
} from "./services/receivedMessageLogStore.js";

function stringifyLogArgs(args: unknown[]): string {
  return args
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
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  hooks: {
    logMethod(args, method) {
      const message = stringifyLogArgs(args);
      const firstArg = args[0];
      const msgAttrs =
        firstArg && typeof firstArg === "object" && "msgAttrs" in firstArg
          ? (firstArg as { msgAttrs?: unknown }).msgAttrs
          : null;

      if (msgAttrs && message.includes("sent retry receipt")) {
        recordReceivedMessageLog({
          phone: getPhoneFromBaileysAttrs(msgAttrs),
          source: "baileys_raw",
          data: { msg: "sent retry receipt", msgAttrs },
        });
      }

      if (isSessionIssueMessage(message)) {
        recordSessionIssue({
          reason: "baileys_logger",
          message,
        });
      }

      method.apply(this, args);
    },
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.x-api-key",
      "webhookSecret",
    ],
    remove: true,
  },
});
