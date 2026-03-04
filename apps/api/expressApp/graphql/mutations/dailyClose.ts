//Docs
// ../../../../schema/lists/DailyCloseRaw.ts

import { graphql } from "@keystone-6/core";
import { upsertByFindFirst } from "../../../lib/utils";
import { logSyncResult } from "../../../lib/logSyncResult";
import { processDailyCloseRaw } from "../../src/utils/dailyClose/processDailyCloseRaw";

export const upsertDailyCloseRaw = graphql.field({
  type: graphql.object<{
    success: boolean;
    date: string;
    syncedAt: string;
  }>()({
    name: "UpsertDailyCloseRawResponse",
    fields: {
      success: graphql.field({ type: graphql.Boolean }),
      date: graphql.field({ type: graphql.String }),
      syncedAt: graphql.field({ type: graphql.String }),
    },
  }),
  args: {
    deviceId: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    date: graphql.arg({ type: graphql.nonNull(graphql.String) }), // YYYY-MM-DD
    payload: graphql.arg({ type: graphql.nonNull(graphql.JSON) }), // el close completo tal cual
  },
  async resolve(_root, args, context) {
    const syncedAt = new Date().toISOString();
    let rawRecord: { id: string } | null = null;

    // (Opcional) validación mínima para evitar basura
    // if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("Invalid date");

    try {
      await upsertByFindFirst(
        context.prisma.dailyCloseRaw,
        {
          deviceId: args.deviceId,
          date: args.date,
        },
        {
          deviceId: args.deviceId,
          date: args.date,
          payload: args.payload,
          status: "RECEIVED",
          receivedAt: new Date(syncedAt),
        },
        {
          // update should not be used really
          payload: args.payload,
          status: "RECEIVED",
          receivedAt: new Date(syncedAt),
          errorMessage: null,
          processedAt: null,
        },
      );
      rawRecord = await context.prisma.dailyCloseRaw.findFirst({
        where: {
          deviceId: args.deviceId,
          date: args.date,
        },
        select: { id: true },
      });

      await processDailyCloseRaw({
        context,
        deviceId: args.deviceId,
        payload: {
          ...(args.payload as Record<string, unknown>),
          date: args.date,
        } as any,
        rawId: rawRecord?.id,
      });
    } catch (error) {
      if (rawRecord?.id) {
        await context.prisma.dailyCloseRaw.update({
          where: { id: rawRecord.id },
          data: {
            status: "FAILED",
            processedAt: new Date(),
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        });
      }
      await logSyncResult({
        context,
        type: "SYNC_DAILY_CLOSE",
        status: "FAILED",
        deviceId: args.deviceId,
        date: args.date,
        errorMessage: error instanceof Error ? error.message : String(error),
        payload: args.payload,
        useRetryCounter: false,
      });
      throw error;
    }

    await logSyncResult({
      context,
      type: "SYNC_DAILY_CLOSE",
      status: "SUCCESS",
      deviceId: args.deviceId,
      date: args.date,
      payload: args.payload,
      logSuccess: false,
      useRetryCounter: false,
    });

    return { success: true, date: args.date, syncedAt };
  },
});
