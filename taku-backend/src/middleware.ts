import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
import { verifyToken } from "./auth.js";
import { ApiError, fail } from "./http.js";
import type { JsonStore } from "./store/jsonStore.js";
import type {
  AdminAuthContext,
  AdminRole,
  AuthContext,
  Role,
  WorkspaceContext,
} from "./types.js";

declare global {
  namespace Express {
    interface Request {
      adminAuth?: AdminAuthContext;
      auth?: AuthContext;
      workspaceContext?: WorkspaceContext;
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
    if (req.path.startsWith("/admin/") || req.path.startsWith("/webhooks/")) {
      next();
      return;
    }
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
    if (!user || user.status !== "active") {
      throw new ApiError({
        status: 401,
        code: user?.status === "disabled" ? "USER_DISABLED" : "UNAUTHORIZED",
        message: "No autenticado.",
      });
    }
    req.auth = { user };
    next();
  });
}

export function requireWorkspace(store: JsonStore) {
  return asyncHandler(async (req, _res, next) => {
    if (req.path.startsWith("/admin/") || req.path.startsWith("/webhooks/")) {
      next();
      return;
    }
    if (!req.auth) {
      throw new ApiError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "No autenticado.",
      });
    }
    const workspaceId = req.header("X-Workspace-Id");
    if (!workspaceId) {
      throw new ApiError({
        status: 400,
        code: "WORKSPACE_REQUIRED",
        message: "Workspace requerido.",
      });
    }
    const database = await store.read();
    const membership = database.memberships.find(
      (item) =>
        item.workspaceId === workspaceId &&
        item.userId === req.auth?.user.id &&
        item.status === "active",
    );
    const workspace = database.workspaces.find(
      (item) => item.id === workspaceId,
    );
    if (!workspace || !membership) {
      throw new ApiError({
        status: 403,
        code: "WORKSPACE_FORBIDDEN",
        message: "No tienes acceso a este workspace.",
      });
    }
    req.workspaceContext = {
      workspace,
      membership,
      role: membership.role,
    };
    next();
  });
}

export function requireAdminAuth(store: JsonStore) {
  return asyncHandler(async (req, _res, next) => {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    if (!token) {
      throw new ApiError({
        status: 401,
        code: "ADMIN_UNAUTHORIZED",
        message: "Admin no autenticado.",
      });
    }
    const payload = verifyToken<{ sub?: unknown; scope?: unknown }>(
      token,
      config.adminJwtSecret,
    );
    const adminUserId = typeof payload?.sub === "string" ? payload.sub : null;
    if (!adminUserId || payload?.scope !== "admin") {
      throw new ApiError({
        status: 401,
        code: "ADMIN_UNAUTHORIZED",
        message: "Token admin invalido.",
      });
    }
    const database = await store.read();
    const adminUser = database.adminUsers.find(
      (item) => item.id === adminUserId,
    );
    if (!adminUser || adminUser.status !== "active") {
      throw new ApiError({
        status: 401,
        code: "ADMIN_UNAUTHORIZED",
        message: "Admin no autenticado.",
      });
    }
    req.adminAuth = { adminUser };
    next();
  });
}

export function requireAdminRole(roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.adminAuth?.adminUser.role;
    if (!role || !roles.includes(role)) {
      next(
        new ApiError({
          status: 403,
          code: "ADMIN_FORBIDDEN",
          message: "No tienes permiso admin para ejecutar esta accion.",
        }),
      );
      return;
    }
    next();
  };
}

export function requireSupportReason(req: Request) {
  const reason =
    typeof req.body?.reason === "string" && req.body.reason.trim()
      ? req.body.reason.trim()
      : null;
  if (!reason) {
    throw new ApiError({
      status: 400,
      code: "SUPPORT_REASON_REQUIRED",
      message: "Motivo requerido para esta accion.",
    });
  }
  return reason;
}

export function requireRole(roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.workspaceContext?.role;
    if (!role || !roles.includes(role)) {
      next(
        new ApiError({
          status: 403,
          code: "FORBIDDEN",
          message: "No tienes permiso para ejecutar esta accion.",
        }),
      );
      return;
    }
    next();
  };
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ApiError) {
    return fail(res, error.status, error.code, error.message, error.details);
  }
  console.error(error);
  return fail(res, 500, "INTERNAL_ERROR", "Error interno.");
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(params: {
  key: (req: Request) => string;
  limit: number;
  windowMs: number;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = params.key(req);
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + params.windowMs });
      next();
      return;
    }
    if (bucket.count >= params.limit) {
      fail(res, 429, "RATE_LIMITED", "Demasiados intentos.");
      return;
    }
    bucket.count += 1;
    next();
  };
}
