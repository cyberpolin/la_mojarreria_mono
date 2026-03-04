import express, { Request, Response, Express } from "express";
import { Context } from ".keystone/types";

type HandlerType = (req: Request, res: Response, ctx: Context) => void;

export const withCtx = (handler: HandlerType, commonContext: Context) => {
  return async (req: Request, res: Response) => {
    const ctx = await commonContext.withRequest(req, res);
    handler(req, res, ctx);
  };
};

export const routeFactory = (app: Express, ctx: Context) => {
  const json = express.json(); // ✅ Middleware de JSON solo para métodos que lo necesitan

  return {
    get: (path: string, handler: HandlerType) =>
      app.get(path, withCtx(handler, ctx)),
    post: (path: string, handler: HandlerType) =>
      app.post(path, json, withCtx(handler, ctx)), // ✅ Aquí sí
    put: (path: string, handler: HandlerType) =>
      app.put(path, json, withCtx(handler, ctx)),
    patch: (path: string, handler: HandlerType) =>
      app.patch(path, json, withCtx(handler, ctx)),
    delete: (path: string, handler: HandlerType) =>
      app.delete(path, withCtx(handler, ctx)),
    options: (path: string, handler: HandlerType) =>
      app.options(path, withCtx(handler, ctx)),
    all: (path: string, handler: HandlerType) =>
      app.all(path, json, withCtx(handler, ctx)), // opcional
  };
};
