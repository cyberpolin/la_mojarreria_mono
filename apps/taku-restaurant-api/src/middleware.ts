import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
import { verifyToken } from "./auth.js";
import { ApiError, fail } from "./http.js";
import type { JsonStore } from "./store.js";
import type { AuthContext } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function asyncHandler(
  handler: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function requireAuth(store: JsonStore) {
  return asyncHandler(async (req, _res, next) => {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    if (!token) {
      throw new ApiError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "No autenticado.",
      });
    }
    const payload = verifyToken<{ sub?: unknown }>(token, config.jwtSecret);
    const userId = typeof payload?.sub === "string" ? payload.sub : null;
    if (!userId) {
      throw new ApiError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Token invalido.",
      });
    }
    const database = await store.read();
    const user = database.users.find((item) => item.id === userId);
    const restaurant = user
      ? database.restaurants.find((item) => item.id === user.restaurantId)
      : null;
    if (!user || user.status !== "active" || !restaurant) {
      throw new ApiError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "No autenticado.",
      });
    }
    req.auth = { user, restaurant };
    next();
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ApiError) {
    fail(res, error.status, error.code, error.message);
    return;
  }
  console.error(error);
  fail(res, 500, "INTERNAL_ERROR", "Error interno.");
}
