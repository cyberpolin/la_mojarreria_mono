import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./web-auth";

export const setSessionCookie = (token: string) => {
  const store = cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
};

export const clearSessionCookie = () => {
  const store = cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
};

export const getSessionToken = () => cookies().get(SESSION_COOKIE)?.value;

export const buildAuthHeaders = () => {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
