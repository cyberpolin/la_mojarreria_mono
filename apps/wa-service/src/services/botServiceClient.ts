import type { Logger } from "pino";
import type { AppConfig } from "../config.js";
import { recordDebugLog } from "./debugLogStore.js";

export type BotHistoryMessage = {
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
};

export type BotReply = {
  text: string;
  shouldSend: boolean;
};

type BotRespondPayload = {
  message: {
    id: string;
    text: string;
    timestamp?: string;
  };
  history: BotHistoryMessage[];
  phone?: string;
};

type BotRespondResponse = {
  ok?: boolean;
  duplicate?: boolean;
  reply?: BotReply | null;
  error?: string;
};

export async function createBotReply(params: {
  config: AppConfig;
  logger: Logger;
  payload: BotRespondPayload;
}): Promise<BotReply | null> {
  if (!params.config.botServiceApiKey) {
    params.logger.error("BOT_SERVICE_API_KEY is not configured");
    recordDebugLog({
      level: "error",
      event: "bot_service_api_key_missing",
    });
    return null;
  }

  recordDebugLog({
    event: "bot_service_request",
    data: {
      url: `${params.config.botServiceBaseUrl}/respond`,
      messageId: params.payload.message.id,
      phone: params.payload.phone,
      textLength: params.payload.message.text.length,
      historySize: params.payload.history.length,
    },
  });

  const response = await fetch(`${params.config.botServiceBaseUrl}/respond`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": params.config.botServiceApiKey,
    },
    body: JSON.stringify(params.payload),
  });
  const body = (await response
    .json()
    .catch(() => null)) as BotRespondResponse | null;

  recordDebugLog({
    event: "bot_service_raw_response",
    data: {
      status: response.status,
      ok: body?.ok,
      duplicate: body?.duplicate,
      error: body?.error,
      hasReply: Boolean(body?.reply),
      shouldSend: body?.reply?.shouldSend,
      replyLength: body?.reply?.text?.trim().length ?? 0,
      messageId: params.payload.message.id,
      phone: params.payload.phone,
    },
  });

  if (!response.ok || !body?.ok) {
    params.logger.error(
      {
        status: response.status,
        error: body?.error ?? "Missing bot-service JSON response",
      },
      "bot-service failed to generate reply",
    );
    recordDebugLog({
      level: "error",
      event: "bot_service_response_failed",
      data: {
        status: response.status,
        error: body?.error ?? "Missing bot-service JSON response",
        messageId: params.payload.message.id,
      },
    });
    return null;
  }

  if (body.duplicate) {
    params.logger.info(
      { messageId: params.payload.message.id },
      "bot-service skipped duplicate message",
    );
    recordDebugLog({
      event: "bot_service_duplicate",
      data: { messageId: params.payload.message.id },
    });
    return null;
  }

  if (!body.reply?.shouldSend || !body.reply.text.trim()) {
    recordDebugLog({
      event: "bot_service_no_sendable_reply",
      data: {
        messageId: params.payload.message.id,
        phone: params.payload.phone,
        reply: body.reply ?? null,
      },
    });
    return null;
  }

  recordDebugLog({
    event: "bot_service_reply_ready",
    data: {
      messageId: params.payload.message.id,
      replyLength: body.reply.text.trim().length,
    },
  });

  return {
    text: body.reply.text.trim(),
    shouldSend: true,
  };
}
