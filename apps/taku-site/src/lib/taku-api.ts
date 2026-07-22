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
  error?: { message?: string };
  pagination?: { page: number; pageSize: number; total: number };
};

export function getWorkspaceSession(): WorkspaceSession | null {
  const session = getAppSession();
  return session?.sessionType === "client" ? session : null;
}

export async function takuApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const session = getWorkspaceSession();
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
  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.error?.message ?? `Request failed with HTTP ${response.status}`,
    );
  }
  return payload.data as T;
}

export async function takuList<T>(path: string): Promise<T[]> {
  return takuApi<T[]>(path);
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
    throw new Error(
      payload?.error?.message ?? `Request failed with HTTP ${response.status}`,
    );
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
