import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
const botApiKey = process.env.TAKU_BOT_API_KEY ?? "";

function botHeaders() {
  return {
    "content-type": "application/json",
    ...(botApiKey
      ? {
          authorization: `Bearer ${botApiKey}`,
          "x-api-key": botApiKey,
        }
      : {}),
  };
}

export async function POST(request: Request) {
  if (!botApiKey) {
    return NextResponse.json(
      { ok: false, error: "TAKU_BOT_API_KEY is not configured" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/public/billing/card-payment`,
    {
      method: "POST",
      headers: botHeaders(),
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload, { status: response.status });
}
