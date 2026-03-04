import { Context } from ".keystone/types";
import { Express } from "express";
import { routeFactory } from "../utils/withCtx";
import { createOrder, pollingOrder } from "../controllers/orderController";

export default (app: Express, commonContext: Context) => {
  const router = routeFactory(app, commonContext);

  router.post("/orders", createOrder);
  router.get("/orders/poll/:listenerId", pollOrders);
  router.get("/orders/updates/:listenerId", pollingOrder);
};

function pollOrders(
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>,
  res: Response<any, Record<string, any>>,
  ctx: Context,
): void {
  throw new Error("Function not implemented.");
}
