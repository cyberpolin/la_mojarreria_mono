import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
const botApiKey = process.env.TAKU_BOT_API_KEY ?? "";

function botHeaders(request: Request) {
  const clientId = request.headers.get("x-taku-client-id");
  const clientToken = request.headers.get("x-taku-client-token");
  return {
    "content-type": "application/json",
    authorization: `Bearer ${botApiKey}`,
    "x-api-key": botApiKey,
    ...(clientId ? { "x-taku-client-id": clientId } : {}),
    ...(clientToken ? { "x-taku-client-token": clientToken } : {}),
  };
}

function requireClientCredentials(request: Request) {
  const clientId = request.headers.get("x-taku-client-id");
  const clientToken = request.headers.get("x-taku-client-token");
  if (!clientId || !clientToken) {
    return NextResponse.json(
      { ok: false, error: "TAKU_CLIENT_ID and TAKU_CLIENT_TOKEN are required" },
      { status: 401 },
    );
  }

  return null;
}

export async function GET(request: Request) {
  const credentialError = requireClientCredentials(request);
  if (credentialError) return credentialError;

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
  const credentialError = requireClientCredentials(request);
  if (credentialError) return credentialError;

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
