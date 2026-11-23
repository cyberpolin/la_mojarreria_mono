import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
const botApiKey = process.env.TAKU_BOT_API_KEY ?? "";

export async function GET(request: Request) {
  if (!botApiKey) {
    return NextResponse.json(
      { ok: false, error: "TAKU_BOT_API_KEY is not configured" },
      { status: 503 },
    );
  }

  const clientId = request.headers.get("x-taku-client-id");
  const clientToken = request.headers.get("x-taku-client-token");
  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: "x-taku-client-id is required" },
      { status: 400 },
    );
  }
  if (!clientToken) {
    return NextResponse.json(
      { ok: false, error: "TAKU_CLIENT_TOKEN is required" },
      { status: 401 },
    );
  }

  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/billing/account`,
    {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${botApiKey}`,
        "x-api-key": botApiKey,
        "x-taku-client-id": clientId,
        "x-taku-client-token": clientToken,
      },
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload, { status: response.status });
}
