import { NextRequest, NextResponse } from "next/server";
import { isActivePromosResponse } from "@/lib/active-promos";

const WA_API_BASE_URL =
  process.env.MOJARRERIA_WA_API_BASE_URL ?? "https://api.wa.lamojarreria.com";
const WA_API_KEY = process.env.MOJARRERIA_WA_API_KEY;
const WA_CLIENT_DOMAIN =
  process.env.MOJARRERIA_WA_CLIENT_DOMAIN ?? "lamojarreria.com";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit") ?? "50";

  if (!WA_API_KEY) {
    return NextResponse.json(
      { error: "MOJARRERIA_WA_API_KEY is required." },
      { status: 500 },
    );
  }

  const url = new URL(
    "/messages/inbound/recent-active-promos",
    WA_API_BASE_URL,
  );
  url.searchParams.set("limit", limit);

  try {
    const response = await fetch(url, {
      headers: {
        "x-api-key": WA_API_KEY,
        "x-client-domain": WA_CLIENT_DOMAIN,
      },
      cache: "no-store",
    });

    const payload: unknown = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: `WhatsApp promos request failed (${response.status})` },
        { status: response.status },
      );
    }

    if (!isActivePromosResponse(payload)) {
      return NextResponse.json(
        { error: "WhatsApp promos response did not match the expected shape." },
        { status: 502 },
      );
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to load active promotions." },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    phone?: unknown;
  } | null;
  const phone = typeof payload?.phone === "string" ? payload.phone.trim() : "";

  if (!/^\d{8,16}$/.test(phone)) {
    return NextResponse.json(
      { error: "A valid phone number is required." },
      { status: 400 },
    );
  }

  if (!WA_API_KEY) {
    return NextResponse.json(
      { error: "MOJARRERIA_WA_API_KEY is required." },
      { status: 500 },
    );
  }

  const url = new URL(
    `/messages/registrations/${encodeURIComponent(phone)}/use`,
    WA_API_BASE_URL,
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": WA_API_KEY,
        "x-client-domain": WA_CLIENT_DOMAIN,
      },
      cache: "no-store",
    });

    const result = (await response.json().catch(() => ({}))) as unknown;

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `WhatsApp use-promo request failed (${response.status})`,
          result,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to mark promotion as used." },
      { status: 502 },
    );
  }
}
