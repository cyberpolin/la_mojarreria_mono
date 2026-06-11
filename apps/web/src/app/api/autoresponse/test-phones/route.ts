import { NextRequest, NextResponse } from "next/server";
import {
  missingConfigResponse,
  WA_API_BASE_URL,
  WA_API_KEY,
  WA_CLIENT_DOMAIN,
} from "@/lib/autoresponse-service-config";

export const dynamic = "force-dynamic";

function headers() {
  return {
    "content-type": "application/json",
    "x-api-key": WA_API_KEY ?? "",
    "x-client-domain": WA_CLIENT_DOMAIN,
  };
}

export async function GET() {
  if (!WA_API_KEY) return missingConfigResponse("MOJARRERIA_WA_API_KEY");

  const response = await fetch(
    `${WA_API_BASE_URL}/service/autoresponse/test-phones`,
    {
      headers: headers(),
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => ({}))) as unknown;

  return NextResponse.json(payload, { status: response.status });
}

export async function PUT(request: NextRequest) {
  if (!WA_API_KEY) return missingConfigResponse("MOJARRERIA_WA_API_KEY");

  const body = await request.json().catch(() => null);
  const response = await fetch(
    `${WA_API_BASE_URL}/service/autoresponse/test-phones`,
    {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => ({}))) as unknown;

  return NextResponse.json(payload, { status: response.status });
}
