import { Router, type Request, type Response } from "express";
import type { Logger } from "pino";
import { z } from "zod";
import type { WhatsAppClient } from "../baileys/client.js";
import type { AppConfig } from "../config.js";
import {
  listAutoresponseTestPhones,
  replaceAutoresponseTestPhones,
} from "../services/autoresponseTestPhoneStore.js";
import { normalizePhone } from "../utils/phone.js";
import { validateServiceRequest } from "../utils/requestAuth.js";

const statusSchema = z.object({
  active: z.boolean(),
});
const testPhonesSchema = z.object({
  phones: z.array(z.string().trim().min(8).max(20)).max(50),
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

export function createServiceRouter(params: {
  config: AppConfig;
  logger: Logger;
  whatsAppClient: WhatsAppClient;
}): Router {
  const router = Router();

  router.get("/status", (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    res.json({ ok: true, ...params.whatsAppClient.getStatus() });
  });

  router.get("/autoresponse/test-phones", async (req, res) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const phones = await listAutoresponseTestPhones(
      params.config.autoresponseTestPhonesFile,
    );
    res.json({ ok: true, phones });
  });

  router.put("/autoresponse/test-phones", async (req, res) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const parsed = testPhonesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid test phones payload",
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const phones = parsed.data.phones.map((phone) => normalizePhone(phone));
      const savedPhones = await replaceAutoresponseTestPhones({
        filePath: params.config.autoresponseTestPhonesFile,
        phones,
      });
      res.json({ ok: true, phones: savedPhones });
    } catch (error) {
      res.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : "Invalid phone",
      });
    }
  });

  router.post("/activate", async (req: Request, res: Response) => {
    params.logger.info("received request to activate WhatsApp service");
    if (!ensureAuthorized(req, res, params.config)) {
      params.logger.warn("unauthorized request to activate WhatsApp service");
      return;
    }

    try {
      params.logger.info("starting WhatsApp service");
      await params.whatsAppClient.start("manual_activate");
      params.logger.info("WhatsApp service started successfully");
      res.json({ ok: true, ...params.whatsAppClient.getStatus() });
    } catch (error) {
      params.logger.error(
        { err: error },
        "error occurred while activating WhatsApp service",
      );
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to activate WhatsApp service",
      });
    }
  });

  router.post("/status", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: "Invalid status payload",
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      if (parsed.data.active) {
        params.logger.info("setting WhatsApp service status to active");
        await params.whatsAppClient.start("set_status_active");
      } else {
        params.logger.info("setting WhatsApp service status to inactive");
        await params.whatsAppClient.stop("set_status_inactive");
      }

      res.json({ ok: true, ...params.whatsAppClient.getStatus() });
    } catch (error) {
      params.logger.error(
        { err: error, active: parsed.data.active },
        "failed to set WhatsApp service status",
      );
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to set WhatsApp service status",
      });
    }
  });

  router.post("/deactivate", async (req: Request, res: Response) => {
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

  router.post("/reset-session", async (req: Request, res: Response) => {
    if (!ensureAuthorized(req, res, params.config)) {
      return;
    }

    try {
      await params.whatsAppClient.resetSession("manual_reset_session");
      res.json({ ok: true, ...params.whatsAppClient.getStatus() });
    } catch (error) {
      params.logger.error({ err: error }, "failed to reset WhatsApp session");
      res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reset WhatsApp session",
      });
    }
  });

  return router;
}
