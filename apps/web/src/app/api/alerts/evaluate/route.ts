import { NextRequest, NextResponse } from "next/server";
import { evaluateAlertRules } from "@/lib/alert-rules";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const payload = await evaluateAlertRules({
      force: Boolean(body.force),
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to evaluate alerts",
      },
      { status: 500 },
    );
  }
}
