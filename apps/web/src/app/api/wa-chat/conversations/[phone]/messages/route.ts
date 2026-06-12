import { NextRequest, NextResponse } from "next/server";
import {
  missingConfigResponse,
  WA_API_BASE_URL,
  WA_API_KEY,
  WA_CLIENT_DOMAIN,
} from "@/lib/autoresponse-service-config";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { phone: string } },
) {
  if (!WA_API_KEY) {
    return missingConfigResponse("MOJARRERIA_WA_API_KEY");
  }

  const limit = request.nextUrl.searchParams.get("limit") ?? "100";
  const phone = encodeURIComponent(params.phone);
  const response = await fetch(
    `${WA_API_BASE_URL}/v1/conversations/${phone}/messages?limit=${encodeURIComponent(limit)}`,
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
        error: payload?.error ?? `WA messages failed (${response.status})`,
      },
      { status: response.status || 502 },
    );
  }

  return NextResponse.json(payload);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { phone: string } },
) {
  if (!WA_API_KEY) {
    return missingConfigResponse("MOJARRERIA_WA_API_KEY");
  }

  const body = await request.json().catch(() => null);
  const phone = encodeURIComponent(params.phone);
  const response = await fetch(
    `${WA_API_BASE_URL}/v1/conversations/${phone}/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": WA_API_KEY,
        "x-client-domain": WA_CLIENT_DOMAIN,
      },
      body: JSON.stringify({ text: body?.text }),
    },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload) {
    return NextResponse.json(
      {
        ok: false,
        error: payload?.error ?? `WA send message failed (${response.status})`,
      },
      { status: response.status || 502 },
    );
  }

  return NextResponse.json(payload);
}
