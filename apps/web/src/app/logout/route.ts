import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/web-auth.server";

export async function GET(request: NextRequest) {
  clearSessionCookie();
  return NextResponse.redirect(new URL("/login", request.url));
}
