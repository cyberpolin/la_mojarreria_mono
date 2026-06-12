import { NextResponse } from "next/server";
import { WA_API_BASE_URL } from "@/lib/autoresponse-service-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const url = `${WA_API_BASE_URL}/debug/received-messages/events`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "text/event-stream" },
    });

    if (!response.ok || !response.body) {
      return NextResponse.json(
        {
          ok: false,
          error: `WA received-message stream failed (${response.status})`,
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
        upstream: url,
      },
      { status: 502 },
    );
  }
}
