import { NextRequest, NextResponse } from "next/server";
import {
  BOT_API_BASE_URL,
  BOT_API_KEY,
  missingConfigResponse,
} from "@/lib/autoresponse-service-config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!BOT_API_KEY) return missingConfigResponse("MOJARRERIA_BOT_API_KEY");

  const response = await fetch(`${BOT_API_BASE_URL}/instructions`, {
    headers: { "x-api-key": BOT_API_KEY },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;

  return NextResponse.json(payload, { status: response.status });
}

export async function PUT(request: NextRequest) {
  if (!BOT_API_KEY) return missingConfigResponse("MOJARRERIA_BOT_API_KEY");

  const body = await request.json().catch(() => null);
  const response = await fetch(`${BOT_API_BASE_URL}/instructions`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-api-key": BOT_API_KEY,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;

  return NextResponse.json(payload, { status: response.status });
}
