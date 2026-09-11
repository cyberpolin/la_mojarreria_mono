"use client";

import {
  getAppSession,
  getAdminSession,
  getBackendApiBaseUrl,
  saveAppSession,
  type AdminSession,
  type WorkspaceSession,
} from "./auth";

type ApiPayload<T> = {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  pagination?: { page: number; pageSize: number; total: number };
};

let workspaceRefreshPromise: Promise<WorkspaceSession | null> | null = null;

export class TakuApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(params: { status: number; code?: string; message: string }) {
    super(params.message);
    this.name = "TakuApiError";
    this.status = params.status;
    this.code = params.code ?? null;
  }
}

export function getWorkspaceSession(): WorkspaceSession | null {
  const session = getAppSession();
  return session?.sessionType === "client" ? session : null;
}

export async function takuApi<T>(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  const session = await getFreshWorkspaceSession();
  if (!session) throw new Error("Sesion requerida.");

  const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessToken}`,
      "x-workspace-id": session.currentWorkspace.id,
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response
    .json()
    .catch(() => null)) as ApiPayload<T> | null;
  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await refreshWorkspaceSession(session);
    if (refreshed) {
      return takuApi<T>(path, init, false);
    }
  }
  if (!response.ok || !payload?.ok) {
    throw new TakuApiError({
      status: response.status,
      code: payload?.error?.code,
      message:
        payload?.error?.message ??
        `Request failed with HTTP ${response.status}`,
    });
  }
  return payload.data as T;
}

export async function takuList<T>(path: string): Promise<T[]> {
  return takuApi<T[]>(path);
}

export type PaginatedResult<T> = {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export async function takuPaginated<T>(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<PaginatedResult<T>> {
  const session = await getFreshWorkspaceSession();
  if (!session) throw new Error("Sesion requerida.");

  const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessToken}`,
      "x-workspace-id": session.currentWorkspace.id,
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiPayload<
    T[]
  > | null;
  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await refreshWorkspaceSession(session);
    if (refreshed) {
      return takuPaginated<T>(path, init, false);
    }
  }
  if (!response.ok || !payload?.ok || !payload.data) {
    throw new TakuApiError({
      status: response.status,
      code: payload?.error?.code,
      message:
        payload?.error?.message ??
        `Request failed with HTTP ${response.status}`,
    });
  }
  const pagination = payload.pagination;
  const total = pagination?.total ?? payload.data.length;
  const pageSize = pagination?.pageSize ?? payload.data.length;
  return {
    items: payload.data,
    pagination: {
      page: pagination?.page ?? 1,
      pageSize,
      total,
      totalPages: pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    },
  };
}

async function getFreshWorkspaceSession() {
  const session = getWorkspaceSession();
  if (!session) return null;
  if (!isTokenExpiring(session.accessToken)) return session;
  return refreshWorkspaceSession(session);
}

function isTokenExpiring(token: string) {
  const payload = decodeJwtPayload(token);
  if (typeof payload?.exp !== "number") return false;
  return payload.exp <= Math.floor(Date.now() / 1000) + 30;
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const [, encodedPayload] = token.split(".");
  if (!encodedPayload) return null;
  try {
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    return JSON.parse(window.atob(padded)) as { exp?: number };
  } catch {
    return null;
  }
}

async function refreshWorkspaceSession(session: WorkspaceSession) {
  if (!workspaceRefreshPromise) {
    workspaceRefreshPromise = refreshWorkspaceSessionOnce(session).finally(
      () => {
        workspaceRefreshPromise = null;
      },
    );
  }
  return workspaceRefreshPromise;
}

async function refreshWorkspaceSessionOnce(session: WorkspaceSession) {
  const response = await fetch(`${getBackendApiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  const payload = (await response.json().catch(() => null)) as ApiPayload<{
    accessToken: string;
    refreshToken: string;
  }> | null;
  if (!response.ok || !payload?.ok || !payload.data) return null;
  const refreshed: WorkspaceSession = {
    ...session,
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken,
  };
  saveAppSession(refreshed);
  return refreshed;
}

export async function takuAdminApi<T>(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  const session = getAdminSession();
  if (!session) throw new Error("Sesion admin requerida.");

  const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response
    .json()
    .catch(() => null)) as ApiPayload<T> | null;
  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await refreshAdminSession(session);
    if (refreshed) {
      return takuAdminApi<T>(path, init, false);
    }
  }
  if (!response.ok || !payload?.ok) {
    throw new TakuApiError({
      status: response.status,
      code: payload?.error?.code,
      message:
        payload?.error?.message ??
        `Request failed with HTTP ${response.status}`,
    });
  }
  return payload.data as T;
}

export async function takuAdminList<T>(path: string): Promise<T[]> {
  return takuAdminApi<T[]>(path);
}

async function refreshAdminSession(session: AdminSession) {
  const response = await fetch(`${getBackendApiBaseUrl()}/admin/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  const payload = (await response.json().catch(() => null)) as ApiPayload<{
    accessToken: string;
    refreshToken: string;
  }> | null;
  if (!response.ok || !payload?.ok || !payload.data) return false;
  saveAppSession({
    ...session,
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken,
  });
  return true;
}
