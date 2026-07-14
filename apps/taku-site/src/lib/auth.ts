"use client";

const sessionKey = "TAKU_SITE_SESSION";
const legacyAdminSessionKey = "TAKU_SITE_ADMIN_SESSION";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

export type AdminSession = {
  sessionType?: "admin";
  accessToken: string;
  refreshToken: string;
  adminUser: AdminUser;
  requiresPasswordChange?: boolean;
};

export type ClientUser = {
  id: string;
  name: string;
  email: string;
  status: string;
};

export type WorkspaceSession = {
  sessionType: "client";
  accessToken: string;
  refreshToken: string;
  user: ClientUser;
  role: string;
  currentWorkspace: {
    id: string;
    name: string;
    slug: string;
    status: string;
    plan: string;
    timezone: string;
    role: string;
  };
  workspaces: Array<WorkspaceSession["currentWorkspace"]>;
};

export type AppSession = AdminSession | WorkspaceSession;

export function getBackendApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_TAKU_BACKEND_API_BASE_URL ??
    "http://localhost:4000/api"
  );
}

export function getAppSession(): AppSession | null {
  if (typeof window === "undefined") return null;
  const raw =
    window.localStorage.getItem(sessionKey) ??
    window.localStorage.getItem(legacyAdminSessionKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppSession>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string"
    )
      return null;
    if (parsed.sessionType === "client" && "user" in parsed && parsed.user)
      return parsed as WorkspaceSession;
    if (
      (!parsed.sessionType || parsed.sessionType === "admin") &&
      "adminUser" in parsed &&
      parsed.adminUser
    )
      return parsed as AdminSession;
    return null;
  } catch {
    return null;
  }
}

export function getAdminSession(): AdminSession | null {
  const session = getAppSession();
  return session && session.sessionType !== "client" ? session : null;
}

export function saveAppSession(session: AppSession) {
  window.localStorage.removeItem(legacyAdminSessionKey);
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
}

export const saveAdminSession = saveAppSession;

export function clearAdminSession() {
  window.localStorage.removeItem(sessionKey);
  window.localStorage.removeItem(legacyAdminSessionKey);
}

export function routeForSession(session: AppSession) {
  if (session.sessionType === "client") return "/main";
  if (session.requiresPasswordChange) return "/update-password";
  if (
    session.adminUser.role === "super_owner" ||
    session.adminUser.role === "super_admin" ||
    session.adminUser.role === "support_admin" ||
    session.adminUser.role === "billing_admin" ||
    session.adminUser.role === "readonly_admin"
  ) {
    return "/admin";
  }
  return "/main";
}

export const routeForAdminSession = routeForSession;
