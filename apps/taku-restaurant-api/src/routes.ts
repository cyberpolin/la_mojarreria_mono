import { Router } from "express";
import { config } from "./config.js";
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  signToken,
  verifyPassword,
} from "./auth.js";
import { ApiError, ok, requireString } from "./http.js";
import { asyncHandler, requireAuth } from "./middleware.js";
import { id, now, type JsonStore } from "./store.js";
import type { Expense, Restaurant, User } from "./types.js";

const ACCESS_TTL_SECONDS = 60 * 60 * 12;
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

function publicRestaurant(restaurant: Restaurant) {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    plan: restaurant.plan,
    timezone: restaurant.timezone,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sessionFor(user: User, restaurant: Restaurant, storeSecret: string) {
  const accessToken = signToken(
    { sub: user.id, restaurantId: restaurant.id, role: user.role },
    config.jwtSecret,
    ACCESS_TTL_SECONDS,
  );
  const refreshToken = createOpaqueToken();
  return {
    sessionType: "client" as const,
    accessToken,
    refreshToken,
    user: publicUser(user),
    restaurant: publicRestaurant(restaurant),
    refreshTokenHash: hashToken(refreshToken, storeSecret),
  };
}

export function createApiRouter(store: JsonStore) {
  const router = Router();

  router.get("/health", (_req, res) => {
    ok(res, { status: "ok", service: "taku-restaurant-api", timestamp: now() });
  });

  router.post(
    "/session/signup",
    asyncHandler(async (req, res) => {
      const name = requireString(req.body?.name, "name");
      const restaurantName = requireString(
        req.body?.restaurantName,
        "restaurantName",
      );
      const email = requireString(req.body?.email, "email").toLowerCase();
      const password = requireString(req.body?.password, "password");
      if (password.length < 8) {
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "El password debe tener al menos 8 caracteres.",
        });
      }
      const result = await store.update((database) => {
        if (database.users.some((item) => item.email === email)) {
          throw new ApiError({
            status: 409,
            code: "CONFLICT",
            message: "Ese email ya tiene cuenta.",
          });
        }
        const restaurant: Restaurant = {
          id: id("restaurant"),
          name: restaurantName,
          slug: slugify(restaurantName) || id("slug"),
          plan: "free",
          timezone: "America/Mexico_City",
          createdAt: now(),
          updatedAt: now(),
        };
        const user: User = {
          id: id("user"),
          restaurantId: restaurant.id,
          name,
          email,
          passwordHash: hashPassword(password),
          role: "owner",
          status: "active",
          createdAt: now(),
          updatedAt: now(),
        };
        database.restaurants.push(restaurant);
        database.users.push(user);
        const session = sessionFor(user, restaurant, config.refreshSecret);
        database.refreshTokens.push({
          id: id("refresh"),
          userId: user.id,
          tokenHash: session.refreshTokenHash,
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
          revokedAt: null,
          createdAt: now(),
        });
        const { refreshTokenHash: _, ...publicSession } = session;
        return publicSession;
      });
      ok(res, result, 201);
    }),
  );

  router.post(
    "/session/login",
    asyncHandler(async (req, res) => {
      const email = requireString(req.body?.email, "email").toLowerCase();
      const password = requireString(req.body?.password, "password");
      const result = await store.update((database) => {
        const user = database.users.find(
          (item) => item.email === email && item.status === "active",
        );
        const restaurant = user
          ? database.restaurants.find((item) => item.id === user.restaurantId)
          : null;
        if (!user || !restaurant || !verifyPassword(password, user.passwordHash)) {
          throw new ApiError({
            status: 401,
            code: "INVALID_CREDENTIALS",
            message: "Credenciales invalidas.",
          });
        }
        const session = sessionFor(user, restaurant, config.refreshSecret);
        database.refreshTokens.push({
          id: id("refresh"),
          userId: user.id,
          tokenHash: session.refreshTokenHash,
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
          revokedAt: null,
          createdAt: now(),
        });
        const { refreshTokenHash: _, ...publicSession } = session;
        return publicSession;
      });
      ok(res, result);
    }),
  );

  router.get(
    "/session/me",
    requireAuth(store),
    asyncHandler(async (req, res) => {
      const auth = req.auth;
      if (!auth) {
        throw new ApiError({
          status: 401,
          code: "UNAUTHORIZED",
          message: "No autenticado.",
        });
      }
      ok(res, {
        user: publicUser(auth.user),
        restaurant: publicRestaurant(auth.restaurant),
      });
    }),
  );

  router.get(
    "/restaurants/current",
    requireAuth(store),
    asyncHandler(async (req, res) => {
      ok(res, publicRestaurant(req.auth!.restaurant));
    }),
  );

  router.get(
    "/expenses",
    requireAuth(store),
    asyncHandler(async (req, res) => {
      const restaurantId = req.auth!.restaurant.id;
      const database = await store.read();
      const items = database.expenses
        .filter((item) => item.restaurantId === restaurantId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      ok(res, items);
    }),
  );

  router.post(
    "/expenses",
    requireAuth(store),
    asyncHandler(async (req, res) => {
      const concept = requireString(req.body?.concept, "concept");
      const amount = Number(req.body?.amount);
      const amountCents = Number.isFinite(amount)
        ? Math.round(amount * 100)
        : Number(req.body?.amountCents ?? 0);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "La cantidad debe ser mayor a 0.",
        });
      }
      const date =
        typeof req.body?.date === "string" && req.body.date.trim()
          ? req.body.date.trim()
          : now().slice(0, 10);
      const expense = await store.update((database) => {
        const row: Expense = {
          id: id("expense"),
          restaurantId: req.auth!.restaurant.id,
          date,
          concept,
          amountCents,
          createdAt: now(),
        };
        database.expenses.push(row);
        return row;
      });
      ok(res, expense, 201);
    }),
  );

  return router;
}
