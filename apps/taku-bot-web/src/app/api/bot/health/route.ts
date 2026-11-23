import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";

export async function GET() {
  const response = await fetch(`${botApiBaseUrl.replace(/\/+$/, "")}/health`, {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(
    {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      payload,
    },
    { status: response.ok ? 200 : 502 },
  );
}
