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

export async function GET(
  request: Request,
  context: { params: { assistantId: string } },
) {
  const credentialError = requireClientCredentials(request);
  if (credentialError) return credentialError;

  const { assistantId } = context.params;
  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/assistants`,
    {
      cache: "no-store",
      headers: botHeaders(request),
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    assistants?: Array<{ id: string }>;
    error?: string;
  } | null;

  if (!response.ok || !payload?.ok || !Array.isArray(payload.assistants)) {
    return NextResponse.json(payload, { status: response.status });
  }

  const assistant =
    payload.assistants.find((item) => item.id === assistantId) ?? null;
  return assistant
    ? NextResponse.json({ ok: true, assistant })
    : NextResponse.json(
        { ok: false, error: "Assistant not found" },
        { status: 404 },
      );
}

export async function PATCH(
  request: Request,
  context: { params: { assistantId: string } },
) {
  const credentialError = requireClientCredentials(request);
  if (credentialError) return credentialError;

  const { assistantId } = context.params;
  const body = (await request.json().catch(() => null)) as unknown;
  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/assistants/${encodeURIComponent(
      assistantId,
    )}`,
    {
      method: "PATCH",
      headers: botHeaders(request),
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  return NextResponse.json(payload, { status: response.status });
}
