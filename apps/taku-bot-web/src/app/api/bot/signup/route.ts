import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/public/accounts`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload, { status: response.status });
}
