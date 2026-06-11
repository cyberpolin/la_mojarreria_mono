import { NextRequest, NextResponse } from "next/server";
import { getServiceDebugBaseUrl } from "@/lib/service-debug-logs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const url = `${baseUrl}/debug/logs/events`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "text/event-stream",
      },
    });

    if (!response.ok || !response.body) {
      return NextResponse.json(
        {
          ok: false,
          error: `Log stream failed (${response.status})`,
          service: params.service,
          upstream: url,
        },
        { status: response.status || 502 },
      );
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to stream logs",
        service: params.service,
        upstream: `${baseUrl}/debug/logs/events`,
      },
      { status: 502 },
    );
  }
}
