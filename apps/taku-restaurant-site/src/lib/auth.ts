"use client";

const sessionKey = "TAKU_RESTAURANT_SESSION";

export type RestaurantSession = {
  sessionType: "client";
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
  };
  restaurant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    timezone: string;
  };
};

export function getRestaurantApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_TAKU_RESTAURANT_API_BASE_URL ??
    "http://localhost:3160/api"
  );
}

export function getSession(): RestaurantSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(sessionKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RestaurantSession>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      !parsed.user ||
      !parsed.restaurant
    ) {
      return null;
    }
    return parsed as RestaurantSession;
  } catch {
    return null;
  }
}

export function saveSession(session: RestaurantSession) {
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(sessionKey);
}
