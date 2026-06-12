import { NextResponse } from "next/server";
import { WA_API_BASE_URL } from "@/lib/autoresponse-service-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch(`${WA_API_BASE_URL}/health`, {
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload) {
    return NextResponse.json(
      {
        ok: false,
        error: payload?.error ?? `WA status failed (${response.status})`,
      },
      { status: response.status || 502 },
    );
  }

  return NextResponse.json(payload);
}
