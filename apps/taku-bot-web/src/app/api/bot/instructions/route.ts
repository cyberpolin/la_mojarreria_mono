import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
const botApiKey = process.env.TAKU_BOT_API_KEY ?? "";

function headers() {
  return {
    "content-type": "application/json",
    "x-api-key": botApiKey,
  };
}

export async function GET() {
  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/instructions`,
    {
      cache: "no-store",
      headers: headers(),
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload, { status: response.status });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/instructions`,
    {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload, { status: response.status });
}
