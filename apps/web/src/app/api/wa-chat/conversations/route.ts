import { NextRequest, NextResponse } from "next/server";
import {
  missingConfigResponse,
  WA_API_BASE_URL,
  WA_API_KEY,
  WA_CLIENT_DOMAIN,
} from "@/lib/autoresponse-service-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!WA_API_KEY) {
    return missingConfigResponse("MOJARRERIA_WA_API_KEY");
  }

  const limit = request.nextUrl.searchParams.get("limit") ?? "100";
  const response = await fetch(
    `${WA_API_BASE_URL}/v1/conversations?limit=${encodeURIComponent(limit)}`,
    {
      cache: "no-store",
      headers: {
        "x-api-key": WA_API_KEY,
        "x-client-domain": WA_CLIENT_DOMAIN,
      },
    },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload) {
    return NextResponse.json(
      {
        ok: false,
        error: payload?.error ?? `WA conversations failed (${response.status})`,
      },
      { status: response.status || 502 },
    );
  }

  return NextResponse.json(payload);
}
