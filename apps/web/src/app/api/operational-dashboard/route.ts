import { NextRequest, NextResponse } from "next/server";
import { fetchDashboardPayload } from "@/lib/operational-dashboard";

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? formatDate(new Date());
  const recentDays = Number(searchParams.get("recentDays") ?? 7);
  const baselineDays = Number(searchParams.get("baselineDays") ?? 7);

  try {
    const payload = await fetchDashboardPayload({
      date,
      recentDays: Number.isFinite(recentDays) ? recentDays : 7,
      baselineDays: Number.isFinite(baselineDays) ? baselineDays : 7,
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load dashboard",
      },
      { status: 500 },
    );
  }
}
