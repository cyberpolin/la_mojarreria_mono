import { Context } from ".keystone/types";
import { Express } from "express";
import { routeFactory } from "../utils/withCtx";

export default (app: Express, commonContext: Context) => {
  const router = routeFactory(app, commonContext);

  router.get("/qr", async (req, res, ctx) => {
    const { connect } = await import("../whatsAppServer");
    return connect(req, res, ctx);
  });

  router.post("/reset", async (req, res, ctx) => {
    const { resetConection } = await import("../whatsAppServer");
    return resetConection(req, res, ctx);
  });
};
