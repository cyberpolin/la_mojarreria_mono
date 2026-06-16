import { Router, type Request, type Response } from "express";
import QRCode from "qrcode";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { WhatsAppClient } from "../baileys/client.js";
import type { ConnectionManager } from "../connections/connectionManager.js";
import {
  getLastConversationMessage,
  listConversationMessages,
  listConversations,
} from "../services/conversationStore.js";
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookSubscriptions,
  type WebhookEventName,
} from "../services/webhookSubscriptionStore.js";
import { normalizePhone } from "../utils/phone.js";
import { validateServiceRequest } from "../utils/requestAuth.js";

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const sendMessageSchema = z.object({
  to: z.string().trim().min(10).max(20),
  text: z.string().trim().min(1).max(4000),
});

const createConnectionSchema = z.object({
  connectionId: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9_-]+$/, "Use only letters, numbers, _ or -")
    .default("default"),
  businessId: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  autoStart: z.boolean().optional(),
});

const webhookSubscriptionSchema = z.object({
  url: z.string().url(),
  events: z
    .array(z.enum(["message.received"]))
    .min(1)
    .default(["message.received"]),
  secret: z.string().trim().min(1).max(500).optional(),
});

function ensureAuthorized(
  req: Request,
  res: Response,
  config: AppConfig,
): boolean {
  const authResult = validateServiceRequest(req, config);
  if (!authResult.ok) {
    res.status(authResult.status).json({ ok: false, error: authResult.error });
    return false;
  }

  return true;
}

function parsePhoneParam(req: Request, res: Response): string | null {
  try {
    return normalizePhone(req.params.phone ?? "");
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Invalid phone",
    });
    return null;
  }
}

function parseConnectionIdParam(req: Request, res: Response): string | null {
  const connectionId = req.params.connectionId?.trim();
  if (!connectionId) {
    res.status(400).json({
      ok: false,
      error: "connectionId is required",
    });
    return null;
  }

  return connectionId;
}

export function createV1Router(params: {
  config: AppConfig;
  whatsAppClient: WhatsAppClient;
  connectionManager: ConnectionManager;
}): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, version: "v1" });
  });

  router.get("/connections", (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const connections = params.connectionManager.list();
    res.json({ ok: true, total: connections.length, connections });
  });

  router.post("/connections", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const parsed = createConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid connection payload",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    if (parsed.data.connectionId === "default") {
      const connection = params.connectionManager.getSnapshot("default");
      if (!connection) {
        res.status(500).json({
          ok: false,
          error: "Default WhatsApp connection is not registered.",
        });
        return;
      }

      res.status(200).json({ ok: true, connection });
      return;
    }

    try {
      const connection = await params.connectionManager.createConnection({
        connectionId: parsed.data.connectionId,
        businessId: parsed.data.businessId ?? null,
        label: parsed.data.label ?? null,
        autoStart: parsed.data.autoStart,
      });
      res.status(201).json({ ok: true, connection });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create WhatsApp connection",
      });
    }
  });

  router.get(
    "/connections/:connectionId/status",
    (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      const connection = params.connectionManager.getSnapshot(connectionId);
      if (!connection) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      res.json({ ok: true, connection });
    },
  );

  router.post(
    "/connections/:connectionId/start",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      if (!params.connectionManager.get(connectionId)) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      try {
        const connection = await params.connectionManager.start(
          connectionId,
          "connection_api_start",
        );
        res.json({ ok: true, connection });
      } catch (error) {
        res.status(500).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to start WhatsApp connection",
        });
      }
    },
  );

  router.post(
    "/connections/:connectionId/stop",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      if (!params.connectionManager.get(connectionId)) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      try {
        const connection = await params.connectionManager.stop(
          connectionId,
          "connection_api_stop",
        );
        res.json({ ok: true, connection });
      } catch (error) {
        res.status(500).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to stop WhatsApp connection",
        });
      }
    },
  );

  router.post(
    "/connections/:connectionId/reset-session",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      if (!params.connectionManager.get(connectionId)) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      try {
        const connection = await params.connectionManager.resetSession(
          connectionId,
          "connection_api_reset_session",
        );
        res.json({ ok: true, connection });
      } catch (error) {
        res.status(500).json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to reset WhatsApp connection session",
        });
      }
    },
  );

  router.get(
    "/connections/:connectionId/qr",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      const connection = params.connectionManager.getSnapshot(connectionId);
      if (!connection) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      const qr = params.connectionManager.getLatestQr(connectionId);
      const qrImage = qr
        ? await QRCode.toDataURL(qr, {
            margin: 2,
            width: 320,
            errorCorrectionLevel: "M",
          })
        : null;

      res.json({ ok: true, connection, qr, qrImage });
    },
  );

  router.post(
    "/connections/:connectionId/messages",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const connectionId = parseConnectionIdParam(req, res);
      if (!connectionId) {
        return;
      }

      if (!params.connectionManager.get(connectionId)) {
        res.status(404).json({
          ok: false,
          error: "WhatsApp connection not found",
        });
        return;
      }

      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid request body",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      try {
        const phone = normalizePhone(parsed.data.to);
        const messageId = await params.connectionManager.sendTextMessage({
          connectionId,
          phone,
          text: parsed.data.text,
        });

        res.json({
          ok: true,
          connectionId,
          to: phone,
          messageId,
        });
      } catch (error) {
        res.status(502).json({
          ok: false,
          error:
            error instanceof Error ? error.message : "Failed to send message",
        });
      }
    },
  );

  router.get("/whatsapp/status", (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    res.json({ ok: true, ...params.whatsAppClient.getStatus() });
  });

  router.get("/service/status", (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    res.json({ ok: true, ...params.whatsAppClient.getStatus() });
  });

  router.post("/service/activate", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    try {
      await params.whatsAppClient.start("manual_activate");
      res.json({ ok: true, ...params.whatsAppClient.getStatus() });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to activate WhatsApp service",
      });
    }
  });

  router.post("/service/deactivate", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    try {
      await params.whatsAppClient.stop("manual_deactivate");
      res.json({ ok: true, ...params.whatsAppClient.getStatus() });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to deactivate WhatsApp service",
      });
    }
  });

  router.post("/service/reset-session", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    try {
      await params.whatsAppClient.resetSession("manual_reset_session");
      res.json({ ok: true, ...params.whatsAppClient.getStatus() });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reset WhatsApp session",
      });
    }
  });

  router.get("/whatsapp/qr", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const qr = params.whatsAppClient.getLatestQr();
    const qrImage = qr
      ? await QRCode.toDataURL(qr, {
          margin: 2,
          width: 320,
          errorCorrectionLevel: "M",
        })
      : null;

    res.json({
      ok: true,
      qr,
      qrImage,
      ...params.whatsAppClient.getStatus(),
    });
  });

  router.post("/messages/send", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid request body",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const phone = normalizePhone(parsed.data.to);
      const messageId = await params.whatsAppClient.sendTextMessage({
        phone,
        text: parsed.data.text,
      });

      res.json({ ok: true, to: phone, messageId });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to send message",
      });
    }
  });

  router.get("/conversations", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const parsed = limitQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid query",
        issues: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const conversations = await listConversations(
      params.config.conversationStoreFile,
      parsed.data.limit,
    );
    res.json({ ok: true, total: conversations.length, conversations });
  });

  router.get(
    "/conversations/:phone/messages",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const phone = parsePhoneParam(req, res);
      if (!phone) {
        return;
      }

      const parsed = limitQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid query",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const messages = await listConversationMessages({
        filePath: params.config.conversationStoreFile,
        phone,
        limit: parsed.data.limit,
      });

      res.json({ ok: true, phone, total: messages.length, messages });
    },
  );

  router.post(
    "/conversations/:phone/messages",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const phone = parsePhoneParam(req, res);
      if (!phone) {
        return;
      }

      const parsed = sendMessageSchema.omit({ to: true }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid request body",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      try {
        const messageId = await params.whatsAppClient.sendTextMessage({
          phone,
          text: parsed.data.text,
        });

        res.json({ ok: true, phone, messageId });
      } catch (error) {
        res.status(502).json({
          ok: false,
          error:
            error instanceof Error ? error.message : "Failed to send message",
        });
      }
    },
  );

  router.get(
    "/conversations/:phone/last-message",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const phone = parsePhoneParam(req, res);
      if (!phone) {
        return;
      }

      const message = await getLastConversationMessage({
        filePath: params.config.conversationStoreFile,
        phone,
      });

      res.json({ ok: true, phone, message });
    },
  );

  router.get("/webhooks/subscriptions", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const subscriptions = await listWebhookSubscriptions(
      params.config.webhookSubscriptionsFile,
    );
    res.json({ ok: true, total: subscriptions.length, subscriptions });
  });

  router.post(
    "/webhooks/subscriptions",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const parsed = webhookSubscriptionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          error: "Invalid request body",
          issues: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const subscription = await createWebhookSubscription({
        filePath: params.config.webhookSubscriptionsFile,
        url: parsed.data.url,
        events: parsed.data.events as WebhookEventName[],
        secret: parsed.data.secret ?? null,
      });

      res.status(201).json({ ok: true, subscription });
    },
  );

  router.delete(
    "/webhooks/subscriptions/:id",
    async (req: Request, res: Response) => {
      if (!ensureAuthorized(req, res, params.config)) {
        return;
      }

      const id = req.params.id;
      if (!id) {
        res.status(400).json({ ok: false, error: "Missing subscription id" });
        return;
      }

      const deleted = await deleteWebhookSubscription(
        params.config.webhookSubscriptionsFile,
        id,
      );
      res.json({ ok: true, deleted });
    },
  );

  return router;
}
