import { NextRequest, NextResponse } from "next/server";
import { fetchCloseReports } from "@/lib/close-reports";

const DEFAULT_LIMIT = 90;
const MAX_LIMIT = 365;

const parseLimit = (value: string | null) => {
  const limit = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const payload = await fetchCloseReports({
      take: parseLimit(searchParams.get("limit")),
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load close reports",
      },
      { status: 500 },
    );
  }
}
