import { NextResponse } from "next/server";
import { fetchDashboardPayload } from "@/lib/operational-dashboard";

const todayISO = () => new Date().toISOString().slice(0, 10);

export async function GET() {
  try {
    const payload = await fetchDashboardPayload({
      date: todayISO(),
      recentDays: 7,
      baselineDays: 7,
    });

    const rows = [
      [
        "date",
        "deviceId",
        "salesTotal",
        "moneyIn",
        "moneyOut",
        "net",
        "syncStatus",
      ].join(","),
      ...payload.recentCloses.map((close) =>
        [
          close.date,
          close.deviceId,
          String(close.totalFromItems),
          String(close.moneyIn),
          String(close.moneyOut),
          String(close.moneyIn - close.moneyOut),
          close.syncStatus,
        ].join(","),
      ),
    ];

    const csv = rows.join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mojarreria-weekly-${todayISO()}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export weekly csv",
      },
      { status: 500 },
    );
  }
}
