import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
const botApiKey = process.env.TAKU_BOT_API_KEY ?? "";

function botHeaders(request: Request) {
  const clientId = request.headers.get("x-taku-client-id");
  return {
    "content-type": "application/json",
    authorization: `Bearer ${botApiKey}`,
    "x-api-key": botApiKey,
    ...(clientId ? { "x-taku-client-id": clientId } : {}),
  };
}

export async function GET(request: Request) {
  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/assistants`,
    {
      cache: "no-store",
      headers: botHeaders(request),
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload, { status: response.status });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/assistants`,
    {
      method: "POST",
      headers: botHeaders(request),
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload, { status: response.status });
}
