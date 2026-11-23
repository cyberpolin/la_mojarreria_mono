import type { NextFunction, Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import type { Logger } from "pino";
import type { AppConfig } from "../config.js";
import { replyToComment, sendMessengerText } from "../meta/graphClient.js";
import { parseReplyText } from "../publicationRuleInput.js";
import { listEventLogs } from "../services/eventLogStore.js";
import {
  deletePage,
  getPage,
  listPages,
  PageStoreError,
  toPublicPage,
  upsertPage,
} from "../services/pageStore.js";
import {
  createPublicationRule,
  deletePublicationRule,
  listPublicationRules,
  PublicationRuleStoreError,
  updatePublicationRule,
} from "../services/publicationRuleStore.js";
import { readObject, readString, safeEqual } from "../text.js";

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ ok: false, error });
}

function requireApiKey(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const provided = req.header("x-api-key") ?? "";
    if (!safeEqual(provided, config.serviceApiKey)) {
      sendError(res, 401, "Unauthorized");
      return;
    }

    next();
  };
}

function readPageId(value: unknown): string | null {
  const pageId = readString(value);
  if (!pageId || !/^[0-9]+$/.test(pageId)) {
    return null;
  }

  return pageId;
}

export function createV1Router(params: {
  config: AppConfig;
  logger: Logger;
}): Router {
  const router = createRouter();
  router.use(requireApiKey(params.config));

  router.get("/status", async (_req, res, next) => {
    try {
      const [pages, rules] = await Promise.all([
        listPages(params.config.pagesFile),
        listPublicationRules(params.config.publicationRulesFile),
      ]);
      res.json({
        ok: true,
        service: "fb-service",
        replyMode: params.config.replyMode,
        backendConfigured: Boolean(
          params.config.takuBackendUrl &&
            params.config.takuBackendWebhookSecret,
        ),
        pageCount: pages.length,
        publicationRuleCount: rules.length,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/pages", async (_req, res, next) => {
    try {
      const pages = await listPages(params.config.pagesFile);
      res.json({ ok: true, pages: pages.map(toPublicPage) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/pages/:pageId", async (req, res, next) => {
    try {
      const pageId = readPageId(req.params.pageId);
      const body = readObject(req.body);
      if (!pageId || !body) {
        sendError(res, 400, "pageId must be a numeric Facebook page id");
        return;
      }

      const accessToken = readString(body.accessToken) ?? undefined;
      const label = readString(body.label) ?? undefined;
      const messengerReplyText =
        body.messengerReplyText === null
          ? null
          : body.messengerReplyText === undefined
            ? undefined
            : readString(body.messengerReplyText);
      if (
        body.messengerReplyText !== undefined &&
        body.messengerReplyText !== null &&
        !messengerReplyText
      ) {
        sendError(res, 400, "messengerReplyText must be text or null");
        return;
      }

      if (messengerReplyText && messengerReplyText.length > 2000) {
        sendError(
          res,
          400,
          "messengerReplyText must be at most 2000 characters",
        );
        return;
      }

      const page = await upsertPage(params.config.pagesFile, {
        pageId,
        label,
        accessToken,
        messengerEnabled:
          typeof body.messengerEnabled === "boolean"
            ? body.messengerEnabled
            : undefined,
        messengerReplyText,
      });
      res.json({ ok: true, page });
    } catch (error) {
      if (error instanceof PageStoreError) {
        sendError(res, error.status, error.message);
        return;
      }
      next(error);
    }
  });

  router.delete("/pages/:pageId", async (req, res, next) => {
    try {
      const pageId = readPageId(req.params.pageId);
      if (!pageId) {
        sendError(res, 400, "pageId must be a numeric Facebook page id");
        return;
      }

      await deletePage(params.config.pagesFile, pageId);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof PageStoreError) {
        sendError(res, error.status, error.message);
        return;
      }
      next(error);
    }
  });

  router.get("/publication-rules", async (req, res, next) => {
    try {
      const pageId = readString(req.query.pageId);
      const rules = await listPublicationRules(
        params.config.publicationRulesFile,
      );
      res.json({
        ok: true,
        rules: pageId ? rules.filter((rule) => rule.pageId === pageId) : rules,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/publication-rules", async (req, res, next) => {
    try {
      const rule = await createPublicationRule(
        params.config.publicationRulesFile,
        req.body,
      );
      res.status(201).json({ ok: true, rule });
    } catch (error) {
      if (error instanceof PublicationRuleStoreError) {
        sendError(res, error.status, error.message);
        return;
      }
      next(error);
    }
  });

  router.patch("/publication-rules/:ruleId", async (req, res, next) => {
    try {
      const ruleId = readString(req.params.ruleId);
      if (!ruleId) {
        sendError(res, 400, "ruleId is required");
        return;
      }

      const rule = await updatePublicationRule(
        params.config.publicationRulesFile,
        ruleId,
        req.body,
      );
      res.json({ ok: true, rule });
    } catch (error) {
      if (error instanceof PublicationRuleStoreError) {
        sendError(res, error.status, error.message);
        return;
      }
      next(error);
    }
  });

  router.delete("/publication-rules/:ruleId", async (req, res, next) => {
    try {
      const ruleId = readString(req.params.ruleId);
      if (!ruleId) {
        sendError(res, 400, "ruleId is required");
        return;
      }

      await deletePublicationRule(params.config.publicationRulesFile, ruleId);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof PublicationRuleStoreError) {
        sendError(res, error.status, error.message);
        return;
      }
      next(error);
    }
  });

  router.get("/events", async (_req, res, next) => {
    try {
      const events = await listEventLogs(params.config.eventLogFile);
      res.json({ ok: true, events });
    } catch (error) {
      next(error);
    }
  });

  router.post("/messenger/messages", async (req, res, next) => {
    try {
      const body = readObject(req.body);
      const pageId = body ? readPageId(body.pageId) : null;
      const recipientId = body ? readString(body.recipientId) : null;
      if (!body || !pageId || !recipientId) {
        sendError(res, 400, "pageId and recipientId are required");
        return;
      }

      const text = parseReplyText(body.text);
      const page = await getPage(params.config.pagesFile, pageId);
      if (!page) {
        sendError(res, 404, "Page not found");
        return;
      }

      await sendMessengerText({
        graphApiVersion: params.config.graphApiVersion,
        pageAccessToken: page.accessToken,
        recipientId,
        text,
      });
      params.logger.info({ pageId, recipientId }, "sent messenger message");
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("text must")) {
        sendError(res, 400, error.message);
        return;
      }
      next(error);
    }
  });

  router.post("/comments/replies", async (req, res, next) => {
    try {
      const body = readObject(req.body);
      const pageId = body ? readPageId(body.pageId) : null;
      const commentId = body ? readString(body.commentId) : null;
      if (!body || !pageId || !commentId) {
        sendError(res, 400, "pageId and commentId are required");
        return;
      }

      const text = parseReplyText(body.text);
      const page = await getPage(params.config.pagesFile, pageId);
      if (!page) {
        sendError(res, 404, "Page not found");
        return;
      }

      await replyToComment({
        graphApiVersion: params.config.graphApiVersion,
        pageAccessToken: page.accessToken,
        commentId,
        text,
      });
      params.logger.info(
        { pageId, commentId },
        "sent publication comment reply",
      );
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("text must")) {
        sendError(res, 400, error.message);
        return;
      }
      next(error);
    }
  });

  return router;
}
