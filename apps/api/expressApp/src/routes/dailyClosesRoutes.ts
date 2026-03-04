import { Context } from ".keystone/types";
import { Express } from "express";
import { routeFactory } from "../utils/withCtx";

export default (app: Express, commonContext: Context) => {
  const router = routeFactory(app, commonContext);

  router.get("/daily-close", async (_req, res) => {
    return res.status(501).json({
      ok: false,
      error:
        "REST daily-close endpoint is not implemented. Use GraphQL upsertDailyCloseRaw.",
    });
  });
};
