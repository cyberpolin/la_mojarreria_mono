import type { NextFunction, Request, Router } from "express";
import { Router as createRouter } from "express";
import type { AppConfig } from "../config.js";
import type { Logger } from "pino";
import { handleInboundEvent } from "../handleInboundEvent.js";
import { replyToComment, sendMessengerText } from "../meta/graphClient.js";
import { parseFacebookWebhook } from "../meta/parseWebhook.js";
import { verifyMetaSignature } from "../meta/signature.js";
import { notifyTakuBackend } from "../services/backendWebhook.js";
import { appendEventLog } from "../services/eventLogStore.js";
import { listPages } from "../services/pageStore.js";
import { claimEvent, releaseEvent } from "../services/processedEventStore.js";
import { listPublicationRules } from "../services/publicationRuleStore.js";
import { readString } from "../text.js";

type RequestWithRawBody = Request & { rawBody?: Buffer };

function queryValue(req: Request, name: string): string | null {
  const direct = req.query[name];
  if (typeof direct === "string") {
    return direct;
  }

  const [parent, child] = name.split(".");
  if (!parent || !child) {
    return null;
  }

  const nested = req.query[parent];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    return null;
  }

  const value = nested[child];
  return typeof value === "string" ? value : null;
}

export function createMetaWebhookRouter(params: {
  config: AppConfig;
  logger: Logger;
}): Router {
  const router = createRouter();

  router.get("/", (req, res) => {
    const mode = queryValue(req, "hub.mode");
    const token = queryValue(req, "hub.verify_token");
    const challenge = queryValue(req, "hub.challenge");
    if (
      mode === "subscribe" &&
      token === params.config.facebookVerifyToken &&
      challenge
    ) {
      res.status(200).type("text/plain").send(challenge);
      return;
    }

    res.status(403).type("text/plain").send("Forbidden");
  });

  router.post("/", async (req: RequestWithRawBody, res, next: NextFunction) => {
    try {
      if (!authorizeMetaPost(req, params.config)) {
        res.status(401).json({ ok: false, error: "Invalid signature" });
        return;
      }

      const events = parseFacebookWebhook(req.body);
      const receivedAt = new Date().toISOString();
      const [pages, rules] = await Promise.all([
        listPages(params.config.pagesFile),
        listPublicationRules(params.config.publicationRulesFile),
      ]);
      let retryable = false;

      for (const event of events) {
        const result = await handleInboundEvent(event, {
          replyMode: params.config.replyMode,
          pages,
          rules,
          claim: (eventId) =>
            claimEvent(params.config.processedEventsFile, eventId),
          release: (eventId) =>
            releaseEvent(params.config.processedEventsFile, eventId),
          sendMessenger: (input) =>
            sendMessengerText({
              graphApiVersion: params.config.graphApiVersion,
              pageAccessToken: input.page.accessToken,
              recipientId: input.recipientId,
              text: input.text,
            }),
          sendCommentReply: (input) =>
            replyToComment({
              graphApiVersion: params.config.graphApiVersion,
              pageAccessToken: input.page.accessToken,
              commentId: input.commentId,
              text: input.text,
            }),
          forwardToBackend: (inbound) =>
            notifyTakuBackend({ config: params.config, event: inbound }),
        });

        if (result.retryable) {
          retryable = true;
        }

        params.logger.info(
          {
            eventId: event.eventId,
            pageId: event.pageId,
            type: event.kind,
            outcome: result.outcome,
            detail: result.detail,
          },
          "facebook inbound event",
        );
        await appendEventLog(params.config.eventLogFile, {
          eventId: event.eventId,
          type: event.kind,
          pageId: event.pageId,
          receivedAt,
          outcome: result.outcome,
          detail: result.detail,
        });
      }

      if (retryable) {
        res.status(500).json({ ok: false, error: "Retryable inbound failure" });
        return;
      }

      res.status(200).json({ ok: true, received: events.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function authorizeMetaPost(
  req: RequestWithRawBody,
  config: AppConfig,
): boolean {
  if (config.facebookSkipSignatureCheck) {
    return true;
  }

  if (!config.facebookAppSecret || !req.rawBody) {
    return false;
  }

  return verifyMetaSignature(
    req.rawBody,
    readString(req.header("x-hub-signature-256")) ?? undefined,
    config.facebookAppSecret,
  );
}
