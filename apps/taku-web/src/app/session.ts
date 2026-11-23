"use client";

export type TakuSession = {
  sub: string;
  name: string;
  role: "superowner" | "client";
  businessId: string | null;
  exp: number;
};

export const takuSessionKey = "TAKU_SESSION";

export function getStoredSession(): {
  token: string;
  session: TakuSession;
} | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(takuSessionKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      token?: unknown;
      session?: Partial<TakuSession>;
    };
    if (
      typeof parsed.token !== "string" ||
      typeof parsed.session?.sub !== "string" ||
      typeof parsed.session.name !== "string" ||
      (parsed.session.role !== "superowner" &&
        parsed.session.role !== "client") ||
      (typeof parsed.session.businessId !== "string" &&
        parsed.session.businessId !== null) ||
      typeof parsed.session.exp !== "number" ||
      parsed.session.exp < Math.floor(Date.now() / 1000)
    ) {
      window.localStorage.removeItem(takuSessionKey);
      return null;
    }

    return {
      token: parsed.token,
      session: parsed.session as TakuSession,
    };
  } catch {
    window.localStorage.removeItem(takuSessionKey);
    return null;
  }
}

export function storeSession(value: {
  token: string;
  session: TakuSession;
}): void {
  window.localStorage.setItem(takuSessionKey, JSON.stringify(value));
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(takuSessionKey);
}

export function getSessionHeaders(): HeadersInit {
  const stored = getStoredSession();
  return stored ? { authorization: `Bearer ${stored.token}` } : {};
}
