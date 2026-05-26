import { Context } from ".keystone/types";
import { Express } from "express";
import { routeFactory } from "../utils/withCtx";
import { DailyClosePayload } from "../types/DailyClosePayload";
import { processDailyCloseRaw } from "../utils/dailyClose/processDailyCloseRaw";

const DEFAULT_REPROCESS_LIMIT = 50;
const MAX_REPROCESS_LIMIT = 200;

const getReprocessLimit = (body: unknown) => {
  if (!body || typeof body !== "object" || !("limit" in body)) {
    return DEFAULT_REPROCESS_LIMIT;
  }

  const value = Number((body as { limit: unknown }).limit);
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_REPROCESS_LIMIT;
  }

  return Math.min(Math.floor(value), MAX_REPROCESS_LIMIT);
};

const getPayloadRecord = (payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return payload as Record<string, unknown>;
};

const getMaintenanceApiKey = () =>
  process.env.API_MAINTENANCE_API_KEY?.trim() ||
  process.env.DAILY_CLOSE_REPROCESS_API_KEY?.trim() ||
  null;

export default (app: Express, commonContext: Context) => {
  const router = routeFactory(app, commonContext);

  router.get("/daily-close", async (_req, res) => {
    return res.status(501).json({
      ok: false,
      error:
        "REST daily-close endpoint is not implemented. Use GraphQL upsertDailyCloseRaw.",
    });
  });

  router.post("/daily-close/reprocess-unprocessed", async (req, res, ctx) => {
    const configuredKey = getMaintenanceApiKey();
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && !configuredKey) {
      return res.status(503).json({
        ok: false,
        error: "API_MAINTENANCE_API_KEY is required in production.",
      });
    }

    if (configuredKey && req.header("x-api-key") !== configuredKey) {
      return res.status(401).json({
        ok: false,
        error: "Invalid API key.",
      });
    }

    const limit = getReprocessLimit(req.body);
    const raws = await ctx.prisma.dailyCloseRaw.findMany({
      where: {
        status: { in: ["RECEIVED", "FAILED"] },
      },
      orderBy: [{ receivedAt: "asc" }],
      take: limit,
      select: {
        id: true,
        deviceId: true,
        date: true,
        payload: true,
      },
    });

    const results: Array<{
      id: string;
      deviceId: string;
      date: string;
      status: "PROCESSED" | "FAILED";
      errorMessage?: string;
    }> = [];

    for (const raw of raws) {
      try {
        const payloadRecord = getPayloadRecord(raw.payload);
        if (!payloadRecord) {
          throw new Error("DailyCloseRaw payload is missing or invalid.");
        }

        await processDailyCloseRaw({
          context: ctx,
          deviceId: raw.deviceId,
          payload: {
            ...payloadRecord,
            date: raw.date,
          } as DailyClosePayload,
          rawId: raw.id,
        });

        results.push({
          id: raw.id,
          deviceId: raw.deviceId,
          date: raw.date,
          status: "PROCESSED",
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        await ctx.prisma.dailyCloseRaw.update({
          where: { id: raw.id },
          data: {
            status: "FAILED",
            processedAt: new Date(),
            errorMessage,
          },
        });

        results.push({
          id: raw.id,
          deviceId: raw.deviceId,
          date: raw.date,
          status: "FAILED",
          errorMessage,
        });
      }
    }

    const processed = results.filter((item) => item.status === "PROCESSED");
    const failed = results.filter((item) => item.status === "FAILED");

    return res.status(200).json({
      ok: true,
      matched: raws.length,
      processed: processed.length,
      failed: failed.length,
      results,
    });
  });
};
