import { NextRequest, NextResponse } from "next/server";
import {
  createAccess,
  createEmployee,
  createSchedule,
  deleteAccess,
  deleteEmployee,
  deleteSchedule,
  getTeamControlData,
  updateAccess,
  updateEmployee,
  updateSchedule,
} from "@/lib/team-control";

export async function GET() {
  try {
    const data = await getTeamControlData();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load team control data",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const entity = String(body.entity ?? "");

    if (entity === "employee") {
      const id = await createEmployee({
        name: String(body.name ?? ""),
        phone: String(body.phone ?? ""),
        role: String(body.role ?? "COOK"),
        active: Boolean(body.active ?? true),
      });
      return NextResponse.json({ ok: true, id }, { status: 201 });
    }

    if (entity === "access") {
      await createAccess({
        email: String(body.email ?? ""),
        pin: body.pin ? String(body.pin) : undefined,
        password: String(body.password ?? "changeme"),
        userId: String(body.userId ?? ""),
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (entity === "schedule") {
      await createSchedule({
        userId: String(body.userId ?? ""),
        days: Array.isArray(body.days)
          ? body.days.map((day) => String(day))
          : [],
        shiftStart: String(body.shiftStart ?? ""),
        shiftEnd: String(body.shiftEnd ?? ""),
        breakMinutes: Number(body.breakMinutes ?? 0),
        active: Boolean(body.active ?? true),
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create team control entity",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const entity = String(body.entity ?? "");
    const id = String(body.id ?? "");
    if (!id)
      return NextResponse.json({ error: "id is required" }, { status: 400 });

    if (entity === "employee") {
      await updateEmployee(id, {
        name: String(body.name ?? ""),
        phone: String(body.phone ?? ""),
        role: String(body.role ?? "COOK"),
        active: Boolean(body.active ?? true),
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (entity === "access") {
      await updateAccess(id, {
        email: String(body.email ?? ""),
        pin: body.pin ? String(body.pin) : undefined,
        password: body.password ? String(body.password) : undefined,
        userId: String(body.userId ?? ""),
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (entity === "schedule") {
      await updateSchedule(id, {
        userId: String(body.userId ?? ""),
        days: Array.isArray(body.days)
          ? body.days.map((day) => String(day))
          : [],
        shiftStart: String(body.shiftStart ?? ""),
        shiftEnd: String(body.shiftEnd ?? ""),
        breakMinutes: Number(body.breakMinutes ?? 0),
        active: Boolean(body.active ?? true),
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update team control entity",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const entity = String(body.entity ?? "");
    const id = String(body.id ?? "");
    if (!id)
      return NextResponse.json({ error: "id is required" }, { status: 400 });

    if (entity === "employee") {
      await deleteEmployee(id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    if (entity === "access") {
      await deleteAccess(id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    if (entity === "schedule") {
      await deleteSchedule(id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete team control entity",
      },
      { status: 500 },
    );
  }
}
