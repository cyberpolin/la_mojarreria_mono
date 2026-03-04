import { Context } from ".keystone/types";
import { Express } from "express";
import { routeFactory } from "../utils/withCtx";
import {
  chatPollById,
  createMessage,
  getMessagesById,
} from "../controllers/messageController";

export default (app: Express, commonContext: Context) => {
  const router = routeFactory(app, commonContext);

  router.post("/messages", createMessage);
  router.get("/messages/:chatSessionId", getMessagesById);
  router.get("/messages/poll/:chatSessionId/:listenerId", chatPollById);
};
