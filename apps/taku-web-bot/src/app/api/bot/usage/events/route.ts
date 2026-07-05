import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
const botApiKey = process.env.TAKU_BOT_API_KEY ?? "";

function redactProviderCost(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const events = record.events;
  if (!Array.isArray(events)) {
    return payload;
  }

  for (const event of events) {
    if (event && typeof event === "object" && !Array.isArray(event)) {
      delete (event as Record<string, unknown>).estimatedProviderCostUsd;
      delete (event as Record<string, unknown>).errorMetadata;
    }
  }

  return payload;
}

export async function GET(request: Request) {
  if (!botApiKey) {
    return NextResponse.json(
      { ok: false, error: "TAKU_BOT_API_KEY is not configured" },
      { status: 503 },
    );
  }

  const requestUrl = new URL(request.url);
  const isSuperadmin = request.headers.get("x-taku-role") === "superadmin";
  const clientId = request.headers.get("x-taku-client-id");
  if (!isSuperadmin && !clientId) {
    return NextResponse.json(
      { ok: false, error: "x-taku-client-id is required" },
      { status: 400 },
    );
  }

  const targetUrl = new URL(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/usage/events`,
  );
  if (isSuperadmin) {
    for (const key of ["client_id", "assistant_id", "limit"]) {
      const value = requestUrl.searchParams.get(key);
      if (value) targetUrl.searchParams.set(key, value);
    }
  } else {
    const scopedClientId = clientId;
    if (!scopedClientId) {
      return NextResponse.json(
        { ok: false, error: "x-taku-client-id is required" },
        { status: 400 },
      );
    }
    targetUrl.searchParams.set("client_id", scopedClientId);
    for (const key of ["assistant_id", "limit"]) {
      const value = requestUrl.searchParams.get(key);
      if (value) targetUrl.searchParams.set(key, value);
    }
  }

  const response = await fetch(targetUrl, {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${botApiKey}`,
      "x-api-key": botApiKey,
    },
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  const visiblePayload = isSuperadmin ? payload : redactProviderCost(payload);

  return NextResponse.json(visiblePayload, { status: response.status });
}
