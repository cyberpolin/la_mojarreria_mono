import { createHmac } from "node:crypto";
import type { AppConfig } from "../config.js";
import type { ParsedFacebookEvent } from "../types.js";

export type FacebookBackendEvent = {
  service: "fb-service";
  pageId: string;
  eventId: string;
  receivedAt: string;
} & (
  | {
      event: "messenger.message";
      data: {
        senderId: string;
        messageId: string;
        text: string;
        timestamp: string;
      };
    }
  | {
      event: "publication.comment";
      data: {
        commentId: string;
        postId: string;
        parentId: string | null;
        fromId: string | null;
        fromName: string | null;
        message: string;
        createdTime: string | null;
      };
    }
);

export function toBackendEvent(
  event: ParsedFacebookEvent,
  receivedAt: string,
): FacebookBackendEvent {
  if (event.kind === "messenger.message") {
    return {
      service: "fb-service",
      event: "messenger.message",
      pageId: event.pageId,
      eventId: event.eventId,
      receivedAt,
      data: {
        senderId: event.senderId,
        messageId: event.messageId,
        text: event.text,
        timestamp: event.timestamp,
      },
    };
  }

  return {
    service: "fb-service",
    event: "publication.comment",
    pageId: event.pageId,
    eventId: event.eventId,
    receivedAt,
    data: {
      commentId: event.commentId,
      postId: event.postId,
      parentId: event.parentId,
      fromId: event.fromId,
      fromName: event.fromName,
      message: event.message,
      createdTime: event.createdTime,
    },
  };
}

export function signBackendBody(
  body: string,
  secret: string,
  timestamp: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

export async function notifyTakuBackend(params: {
  config: Pick<
    AppConfig,
    "takuBackendUrl" | "takuBackendWebhookSecret" | "takuBackendWebhookPath"
  >;
  event: ParsedFacebookEvent;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): Promise<void> {
  const { config } = params;
  if (!config.takuBackendUrl || !config.takuBackendWebhookSecret) {
    throw new Error("taku-backend webhook is not configured");
  }

  const receivedAt = (params.now ?? (() => new Date()))().toISOString();
  const payload = toBackendEvent(params.event, receivedAt);
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.parse(receivedAt) / 1000));
  const signature = signBackendBody(
    body,
    config.takuBackendWebhookSecret,
    timestamp,
  );
  const response = await (params.fetchImpl ?? fetch)(
    `${config.takuBackendUrl}${config.takuBackendWebhookPath}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-timestamp": timestamp,
        "x-signature": signature,
        "x-fb-service-secret": config.takuBackendWebhookSecret,
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(
      `taku-backend webhook failed with status ${response.status}`,
    );
  }
}
