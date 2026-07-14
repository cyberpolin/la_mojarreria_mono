import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
const botApiKey = process.env.TAKU_BOT_API_KEY ?? "";

export async function GET() {
  if (!botApiKey) {
    return NextResponse.json(
      { ok: false, error: "TAKU_BOT_API_KEY is not configured" },
      { status: 503 },
    );
  }

  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/runtime/status`,
    {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${botApiKey}`,
        "x-api-key": botApiKey,
      },
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload, { status: response.status });
}
