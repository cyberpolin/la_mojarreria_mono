import { NextResponse } from "next/server";

const backendApiBaseUrl =
  process.env.TAKU_BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_TAKU_BACKEND_API_BASE_URL ??
  "http://localhost:4000/api";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const response = await fetch(
    `${backendApiBaseUrl.replace(/\/+$/, "")}/public/billing/card-payment`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => null)) as unknown;
  return NextResponse.json(payload, { status: response.status });
}
