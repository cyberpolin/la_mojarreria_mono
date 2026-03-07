import { cookies } from "next/headers";
import { getExpectedSessionToken, SESSION_COOKIE } from "./web-auth";

export const setSessionCookie = () => {
  const token = getExpectedSessionToken();
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
