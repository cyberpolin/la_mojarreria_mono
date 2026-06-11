import { createServer, type IncomingMessage } from "node:http";
import type { Logger } from "pino";
import type { config as appConfig } from "./config.js";
import {
  createDeepSeekReply,
  DeepSeekProviderError,
  type ChatMessage,
} from "./deepseekClient.js";
import { readRequestJson, sendJson, type JsonResponse } from "./http.js";
import { getInstructions, saveInstructions } from "./instructionsStore.js";
import {
  hasProcessedMessage,
  recordProcessedMessage,
} from "./processedMessagesStore.js";
import {
  listDebugLogs,
  recordDebugLog,
  sendDebugLogsPage,
  subscribeDebugLogs,
} from "./debugLogStore.js";

type AppConfig = typeof appConfig;

type BotMessage = {
  id: string;
  text: string;
  timestamp?: string;
};

type BotHistoryMessage = {
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
};

function isAuthorized(req: IncomingMessage, config: AppConfig): boolean {
  return req.headers["x-api-key"] === config.apiKey;
}

function parseInstructionsBody(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const instructions = (body as Record<string, unknown>).instructions;
  return typeof instructions === "string" && instructions.trim()
    ? instructions.trim()
    : null;
}

function parseRespondBody(
  body: unknown,
): { message: BotMessage; history: BotHistoryMessage[] } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const message = record.message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return null;
  }

  const messageRecord = message as Record<string, unknown>;
  if (
    typeof messageRecord.id !== "string" ||
    !messageRecord.id.trim() ||
    typeof messageRecord.text !== "string" ||
    !messageRecord.text.trim()
  ) {
    return null;
  }

  const history = Array.isArray(record.history)
    ? record.history.flatMap((item): BotHistoryMessage[] => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return [];
        }

        const historyRecord = item as Record<string, unknown>;
        if (
          (historyRecord.role !== "user" &&
            historyRecord.role !== "assistant") ||
          typeof historyRecord.text !== "string" ||
          !historyRecord.text.trim()
        ) {
          return [];
        }

        return [
          {
            role: historyRecord.role,
            text: historyRecord.text.trim(),
            timestamp:
              typeof historyRecord.timestamp === "string"
                ? historyRecord.timestamp
                : undefined,
          },
        ];
      })
    : [];

  return {
    message: {
      id: messageRecord.id.trim(),
      text: messageRecord.text.trim(),
      timestamp:
        typeof messageRecord.timestamp === "string"
          ? messageRecord.timestamp
          : undefined,
    },
    history,
  };
}

function parseDeepSeekTestBody(body: unknown): { message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { message: "Reply with exactly: deepseek-ok" };
  }

  const message = (body as Record<string, unknown>).message;
  return typeof message === "string" && message.trim()
    ? { message: message.trim() }
    : { message: "Reply with exactly: deepseek-ok" };
}

function buildChatMessages(params: {
  instructions: string;
  message: BotMessage;
  history: BotHistoryMessage[];
}): ChatMessage[] {
  const historyMessages: ChatMessage[] = params.history.slice(-10).map(
    (message): ChatMessage => ({
      role: message.role,
      content: message.text,
    }),
  );

  return [
    {
      role: "system",
      content: params.instructions,
    },
    ...historyMessages,
    {
      role: "user",
      content: params.message.text,
    },
  ];
}

function isBotProviderError(error: unknown): error is DeepSeekProviderError {
  return error instanceof DeepSeekProviderError;
}

function buildBotProviderUnavailableResponse(): JsonResponse {
  return {
    status: 503,
    body: {
      ok: false,
      error: "Bot provider unavailable",
      code: "BOT_PROVIDER_UNAVAILABLE",
      fallbackMessage:
        "Por ahora no puedo consultar al asistente. Un momento por favor, alguien del equipo te atendera.",
    },
  };
}

export function createBotServer(config: AppConfig, logger: Logger) {
  return createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const path = new URL(req.url ?? "/", "http://localhost").pathname;

    let response: JsonResponse;

    try {
      if (method === "GET" && path === "/debug/logs") {
        sendDebugLogsPage(res, "bot-service logs");
        return;
      } else if (method === "GET" && path === "/debug/logs/recent") {
        response = { status: 200, body: { ok: true, logs: listDebugLogs() } };
      } else if (method === "GET" && path === "/debug/logs/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
        const unsubscribe = subscribeDebugLogs((entry) => {
          res.write(`data: ${JSON.stringify(entry)}\n\n`);
        });
        req.on("close", unsubscribe);
        return;
      } else if (method === "GET" && path === "/health") {
        response = { status: 200, body: { ok: true } };
      } else if (method === "POST" && path === "/test/deepseek") {
        if (!isAuthorized(req, config)) {
          response = {
            status: 401,
            body: { ok: false, error: "Unauthorized" },
          };
        } else {
          const payload = parseDeepSeekTestBody(await readRequestJson(req));
          try {
            const replyText = await createDeepSeekReply({
              config,
              messages: [
                {
                  role: "system",
                  content:
                    "You are a terse connectivity smoke test. Keep the reply under 20 words.",
                },
                {
                  role: "user",
                  content: payload.message,
                },
              ],
            });
            response = {
              status: 200,
              body: {
                ok: true,
                model: config.deepseekModel,
                reply: {
                  text: replyText,
                },
              },
            };
          } catch (error) {
            if (!isBotProviderError(error)) {
              throw error;
            }

            logger.error(
              {
                err: error,
                providerStatus: error.status,
                providerBody: error.responseBody,
              },
              "bot provider unavailable",
            );
            response = buildBotProviderUnavailableResponse();
          }
        }
      } else if (method === "GET" && path === "/instructions") {
        if (!isAuthorized(req, config)) {
          response = {
            status: 401,
            body: { ok: false, error: "Unauthorized" },
          };
        } else {
          const instructions = await getInstructions(config.instructionsFile);
          response = instructions
            ? { status: 200, body: { ok: true, ...instructions } }
            : {
                status: 404,
                body: { ok: false, error: "No instructions configured" },
              };
        }
      } else if (method === "PUT" && path === "/instructions") {
        if (!isAuthorized(req, config)) {
          response = {
            status: 401,
            body: { ok: false, error: "Unauthorized" },
          };
        } else {
          const instructions = parseInstructionsBody(
            await readRequestJson(req),
          );
          if (!instructions) {
            response = {
              status: 400,
              body: { ok: false, error: "instructions is required" },
            };
          } else {
            const record = await saveInstructions({
              filePath: config.instructionsFile,
              instructions,
            });
            response = { status: 200, body: { ok: true, ...record } };
          }
        }
      } else if (method === "POST" && path === "/respond") {
        if (!isAuthorized(req, config)) {
          recordDebugLog({
            level: "warn",
            event: "respond_unauthorized",
          });
          response = {
            status: 401,
            body: { ok: false, error: "Unauthorized" },
          };
        } else {
          const instructions = await getInstructions(config.instructionsFile);
          if (!instructions) {
            recordDebugLog({
              level: "warn",
              event: "respond_missing_instructions",
            });
            response = {
              status: 409,
              body: { ok: false, error: "No instructions configured" },
            };
          } else {
            const payload = parseRespondBody(await readRequestJson(req));
            if (!payload) {
              recordDebugLog({
                level: "warn",
                event: "respond_invalid_payload",
              });
              response = {
                status: 400,
                body: { ok: false, error: "Invalid respond payload" },
              };
            } else if (
              await hasProcessedMessage({
                filePath: config.processedMessagesFile,
                messageId: payload.message.id,
              })
            ) {
              recordDebugLog({
                event: "respond_duplicate",
                data: { messageId: payload.message.id },
              });
              response = {
                status: 200,
                body: { ok: true, duplicate: true, reply: null },
              };
            } else {
              try {
                recordDebugLog({
                  event: "deepseek_request",
                  data: {
                    messageId: payload.message.id,
                    historySize: payload.history.length,
                    model: config.deepseekModel,
                  },
                });
                const replyText = await createDeepSeekReply({
                  config,
                  messages: buildChatMessages({
                    instructions: instructions.instructions,
                    message: payload.message,
                    history: payload.history,
                  }),
                });
                await recordProcessedMessage({
                  filePath: config.processedMessagesFile,
                  messageId: payload.message.id,
                });
                logger.info(
                  {
                    messageId: payload.message.id,
                    historySize: payload.history.length,
                  },
                  "bot response generated",
                );
                recordDebugLog({
                  event: "respond_reply_generated",
                  data: {
                    messageId: payload.message.id,
                    historySize: payload.history.length,
                    replyLength: replyText.length,
                  },
                });
                response = {
                  status: 200,
                  body: {
                    ok: true,
                    duplicate: false,
                    reply: {
                      text: replyText,
                      shouldSend: true,
                    },
                  },
                };
              } catch (error) {
                if (!isBotProviderError(error)) {
                  throw error;
                }

                logger.error(
                  {
                    err: error,
                    messageId: payload.message.id,
                    providerStatus: error.status,
                    providerBody: error.responseBody,
                  },
                  "bot provider unavailable",
                );
                recordDebugLog({
                  level: "error",
                  event: "deepseek_provider_unavailable",
                  data: {
                    messageId: payload.message.id,
                    providerStatus: error.status,
                    providerBody: error.responseBody,
                  },
                });
                response = buildBotProviderUnavailableResponse();
              }
            }
          }
        }
      } else {
        response = { status: 404, body: { ok: false, error: "Not found" } };
      }
    } catch (error) {
      logger.error({ err: error, method, path }, "request failed");
      recordDebugLog({
        level: "error",
        event: "request_failed",
        data: {
          method,
          path,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      response = { status: 500, body: { ok: false, error: "Internal error" } };
    }

    sendJson(res, response);
  });
}
