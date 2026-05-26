import { NextRequest, NextResponse } from "next/server";
import { getAttendanceOverview } from "@/lib/attendance";

const todayISO = () => new Date().toISOString().slice(0, 10);

const parseDate = (value: string | null) => {
  const date = String(value ?? todayISO()).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
};

const getDateInRange = (date: string, startDate: string, endDate: string) =>
  date >= startDate && date <= endDate ? date : startDate;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = parseDate(searchParams.get("startDate"));
  const endDate = parseDate(searchParams.get("endDate") ?? startDate);
  const date = getDateInRange(
    parseDate(searchParams.get("date")),
    startDate,
    endDate,
  );
  const deviceId = String(searchParams.get("deviceId") ?? "Kiosk001").trim();

  if (!deviceId) {
    return NextResponse.json(
      { error: "deviceId is required" },
      { status: 400 },
    );
  }

  try {
    const payload = await getAttendanceOverview({
      date,
      startDate,
      endDate,
      deviceId,
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load attendance",
      },
      { status: 500 },
    );
  }
}
