import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/web-auth";

const PUBLIC_PATHS = [
  "/login",
  "/logout",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
  pathname.startsWith("/_next");

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (token) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
