import { NextRequest, NextResponse } from "next/server";
import { createExpense, getExpenses } from "@/lib/expenses";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 365;

const parseLimit = (value: string | null) => {
  const limit = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
};

const parseAmountCents = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const payload = await getExpenses({
      take: parseLimit(searchParams.get("limit")),
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load expenses",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const date = String(body.date ?? "").trim();
    const concept = String(body.concept ?? "").trim();
    const amountCents = parseAmountCents(body.amount);
    const notes = String(body.notes ?? "").trim();

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }
    if (!concept) {
      return NextResponse.json(
        { error: "concept is required" },
        { status: 400 },
      );
    }
    if (amountCents <= 0) {
      return NextResponse.json(
        { error: "amount must be greater than 0" },
        { status: 400 },
      );
    }

    await createExpense({ date, concept, amountCents, notes });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create expense",
      },
      { status: 500 },
    );
  }
}
