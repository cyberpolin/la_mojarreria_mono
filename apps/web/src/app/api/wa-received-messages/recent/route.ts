import { NextResponse } from "next/server";
import { WA_API_BASE_URL } from "@/lib/autoresponse-service-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = `${WA_API_BASE_URL}/debug/received-messages/recent`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload) {
      return NextResponse.json(
        {
          ok: false,
          error: `WA received-message logs failed (${response.status})`,
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
        upstream: url,
      },
      { status: 502 },
    );
  }
}
