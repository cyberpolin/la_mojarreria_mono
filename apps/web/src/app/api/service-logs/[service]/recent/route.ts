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
    const url = `${baseUrl}/debug/logs/recent`;
    const response = await fetch(url, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok || !payload) {
      return NextResponse.json(
        {
          ok: false,
          error: `Log request failed (${response.status})`,
          service: params.service,
          upstream: url,
        },
        { status: response.status || 502 },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load logs",
        service: params.service,
        upstream: `${baseUrl}/debug/logs/recent`,
      },
      { status: 502 },
    );
  }
}
