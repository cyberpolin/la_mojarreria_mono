import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
const botApiKey = process.env.TAKU_BOT_API_KEY ?? "";

export async function POST(request: Request) {
  if (!botApiKey) {
    return NextResponse.json(
      { error: { message: "TAKU_BOT_API_KEY is not configured" } },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const clientId =
    request.headers.get("x-taku-client-id") ??
    (body && typeof body === "object" && !Array.isArray(body)
      ? typeof (body as Record<string, unknown>).client_id === "string"
        ? ((body as Record<string, unknown>).client_id as string)
        : null
      : null);
  const clientToken =
    request.headers.get("x-taku-client-token") ??
    (body && typeof body === "object" && !Array.isArray(body)
      ? typeof (body as Record<string, unknown>).client_token === "string"
        ? ((body as Record<string, unknown>).client_token as string)
        : null
      : null);
  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${botApiKey}`,
        "x-api-key": botApiKey,
        ...(clientId ? { "x-taku-client-id": clientId } : {}),
        ...(clientToken ? { "x-taku-client-token": clientToken } : {}),
      },
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload, { status: response.status });
}
