import type { Logger } from "pino";
import type { ConversationMessage } from "./conversationStore.js";
import {
  listWebhookSubscriptions,
  type WebhookEventName,
} from "./webhookSubscriptionStore.js";

type WebhookPayload = {
  event: WebhookEventName;
  eventId?: string;
  provider: "baileys";
  connectionId?: string;
  businessId?: string | null;
  occurredAt?: string;
  message: ConversationMessage;
};

export async function dispatchWebhookEvent(params: {
  filePath: string;
  logger: Logger;
  event: WebhookEventName;
  payload: WebhookPayload;
}): Promise<boolean> {
  const subscriptions = await listWebhookSubscriptions(params.filePath);
  const targets = subscriptions.filter(
    (subscription) =>
      subscription.active &&
      subscription.events.includes(params.event) &&
      (subscription.accountId === null ||
        subscription.accountId === params.payload.businessId) &&
      (subscription.connectionIds === null ||
        (params.payload.connectionId !== undefined &&
          subscription.connectionIds.includes(params.payload.connectionId))),
  );

  const skipped = await Promise.all(
    targets.map(async (subscription) => {
      try {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "x-wa-service-event": params.event,
        };

        if (subscription.secret) {
          headers["x-wa-service-secret"] = subscription.secret;
        }

        const response = await fetch(subscription.url, {
          method: "POST",
          headers,
          body: JSON.stringify(params.payload),
        });

        if (!response.ok) {
          params.logger.warn(
            {
              status: response.status,
              subscriptionId: subscription.id,
              url: subscription.url,
            },
            "v1 webhook subscription request failed",
          );
          return false;
        }

        const body = (await response.json().catch(() => null)) as {
          data?: { skipAutoReply?: unknown };
          skipAutoReply?: unknown;
        } | null;
        return (
          body?.data?.skipAutoReply === true || body?.skipAutoReply === true
        );
      } catch (error) {
        params.logger.warn(
          {
            err: error,
            subscriptionId: subscription.id,
            url: subscription.url,
          },
          "v1 webhook subscription request failed",
        );
        return false;
      }
    }),
  );
  return skipped.some(Boolean);
}
