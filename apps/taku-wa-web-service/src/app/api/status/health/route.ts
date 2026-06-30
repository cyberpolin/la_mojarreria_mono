import { NextResponse } from "next/server";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_API_BASE_URL ?? "http://localhost:3001";
const healthUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_HEALTH_URL ??
  `${apiBaseUrl.replace(/\/+$/, "")}/health`;
const effectiveHealthUrl = healthUrl.replace(/\/v1\/health\/?$/, "/health");

export async function GET(request: Request) {
  const expectedPassword = process.env.TAKU_SUPEROWNER_PASSWORD ?? "";
  const submittedPassword = request.headers.get("x-taku-status-password") ?? "";

  if (!expectedPassword) {
    return NextResponse.json(
      { ok: false, error: "TAKU_SUPEROWNER_PASSWORD is not configured" },
      { status: 500 },
    );
  }

  if (submittedPassword !== expectedPassword) {
    return NextResponse.json(
      { ok: false, error: "TAKU superowner password required" },
      { status: 403 },
    );
  }

  try {
    const response = await fetch(effectiveHealthUrl, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
    } | null;

    return NextResponse.json({
      ok: true,
      healthOk: response.ok && Boolean(payload?.ok),
      status: response.status,
      statusText: response.statusText,
      healthUrl: effectiveHealthUrl,
      configuredHealthUrl: healthUrl,
      payload,
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      healthOk: false,
      status: null,
      statusText: "unreachable",
      healthUrl: effectiveHealthUrl,
      configuredHealthUrl: healthUrl,
      error:
        error instanceof Error
          ? error.message
          : "Unable to reach health endpoint",
    });
  }
}
