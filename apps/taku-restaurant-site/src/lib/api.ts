"use client";

import {
  getRestaurantApiBaseUrl,
  getSession,
  type RestaurantSession,
} from "./auth";

type ApiPayload<T> = {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

export class RestaurantApiError extends Error {
  readonly status: number;
  constructor(params: { status: number; message: string }) {
    super(params.message);
    this.status = params.status;
  }
}

export async function restaurantApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const session = getSession();
  const response = await fetch(`${getRestaurantApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(session ? { authorization: `Bearer ${session.accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiPayload<T> | null;
  if (!response.ok || !payload?.ok) {
    throw new RestaurantApiError({
      status: response.status,
      message: payload?.error?.message ?? `HTTP ${response.status}`,
    });
  }
  return payload.data as T;
}

export async function loginRequest(params: {
  email: string;
  password: string;
}) {
  return restaurantApi<RestaurantSession>("/session/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function signupRequest(params: {
  name: string;
  restaurantName: string;
  email: string;
  password: string;
}) {
  return restaurantApi<RestaurantSession>("/session/signup", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
