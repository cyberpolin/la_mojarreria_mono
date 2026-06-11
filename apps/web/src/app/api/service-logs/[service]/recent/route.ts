import { NextRequest, NextResponse } from "next/server";
import { getServiceDebugBaseUrl } from "@/lib/service-debug-logs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { service: string } },
) {
  const baseUrl = getServiceDebugBaseUrl(params.service);
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: "Unknown service" },
      { status: 404 },
    );
  }

  try {
    const response = await fetch(`${baseUrl}/debug/logs/recent`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok || !payload) {
      return NextResponse.json(
        { ok: false, error: `Log request failed (${response.status})` },
        { status: response.status || 502 },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load logs",
      },
      { status: 502 },
    );
  }
}
