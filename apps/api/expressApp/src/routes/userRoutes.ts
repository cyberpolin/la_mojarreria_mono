import { Context } from ".keystone/types";
import { Express } from "express";
import {
  getAllUsers,
  getUserById,
  getUserOrders,
  getUserChats,
  createUser,
  createPromoUser,
} from "../controllers/userController";
import { routeFactory } from "../utils/withCtx";

export default (app: Express, commonContext: Context) => {
  const router = routeFactory(app, commonContext);
  router.get("/users", getAllUsers);
  router.get("/users/:id", getUserById);
  router.get("/users/:id/orders", getUserOrders);
  router.get("/users/:id/chats", getUserChats);
  router.post("/users", createUser);
  router.post("/users/promo", createPromoUser);
};
