import { Context } from ".keystone/types";
import { Express } from "express";
import { routeFactory } from "../utils/withCtx";
import {
  handleIncomingMessage,
  verifyToken,
} from "../controllers/whatsappController";

export default (app: Express, commonContext: Context) => {
  const router = routeFactory(app, commonContext);

  router.get("/whatsapp/webhook", verifyToken);
  router.post("/whatsapp/webhook", handleIncomingMessage);
};
