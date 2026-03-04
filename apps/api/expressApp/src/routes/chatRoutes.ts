import { Context } from ".keystone/types";
import { Express } from "express";
import { routeFactory } from "../utils/withCtx";
import {
  getAllChats,
  getChatById,
  createChat,
  updateChatStatus,
  getChatByPhone,
  toggleChatStatus,
  getChatStatus,
} from "../controllers/chatController";

export default (app: Express, commonContext: Context) => {
  const router = routeFactory(app, commonContext);

  router.get("/chats/", getAllChats);
  router.get("/chats/:id", getChatById);
  router.get("/chats/by-phone/:phone", getChatByPhone);
  router.post("/chats/", createChat); // crear chat con usuario (y agente opcional)
  // router.post('/chats/:id/messages', addMessageToChat); // agregar mensaje al chat
  // router.patch('/chats/:id/assign-agent', assignAgentToChat);
  router.patch("/chats/:id/status", updateChatStatus);
  router.patch("/chats/toggle-status/:id", toggleChatStatus);
  router.get("/chats/:id/status", getChatStatus);
};
