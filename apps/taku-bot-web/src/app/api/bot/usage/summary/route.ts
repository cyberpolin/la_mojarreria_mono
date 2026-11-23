import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
const botApiKey = process.env.TAKU_BOT_API_KEY ?? "";

function redactProviderCost(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const summary = record.summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return payload;
  }

  const summaryRecord = summary as Record<string, unknown>;
  delete summaryRecord.estimatedProviderCostUsd;
  for (const key of ["byClient", "byAssistant"]) {
    const rows = summaryRecord[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        delete (row as Record<string, unknown>).estimatedProviderCostUsd;
      }
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
  const clientToken = request.headers.get("x-taku-client-token");
  if (!isSuperadmin && !clientId) {
    return NextResponse.json(
      { ok: false, error: "x-taku-client-id is required" },
      { status: 400 },
    );
  }
  if (!isSuperadmin && !clientToken) {
    return NextResponse.json(
      { ok: false, error: "TAKU_CLIENT_TOKEN is required" },
      { status: 401 },
    );
  }

  const targetUrl = new URL(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/usage/summary`,
  );
  if (isSuperadmin) {
    for (const key of ["client_id", "assistant_id"]) {
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
    const assistantId = requestUrl.searchParams.get("assistant_id");
    if (assistantId) targetUrl.searchParams.set("assistant_id", assistantId);
  }

  const response = await fetch(targetUrl, {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${botApiKey}`,
      "x-api-key": botApiKey,
      ...(clientToken ? { "x-taku-client-token": clientToken } : {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  const visiblePayload = isSuperadmin ? payload : redactProviderCost(payload);

  return NextResponse.json(visiblePayload, { status: response.status });
}
