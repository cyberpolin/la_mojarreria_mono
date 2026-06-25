import { NextRequest, NextResponse } from "next/server";
import {
  createAlertRule,
  deleteAlertRule,
  evaluateAlertRules,
  getAlertSetupOptions,
  updateAlertRule,
} from "@/lib/alert-rules";
import { AlertMetric, AlertRuleInput } from "@/types/alert-rule";

const metrics = new Set<AlertMetric>(["LOW_MOJARRAS"]);

const parseInteger = (value: unknown, field: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
};

const parseInput = (body: Record<string, unknown>): AlertRuleInput => {
  const metric = String(body.metric ?? "LOW_MOJARRAS");
  if (!metrics.has(metric as AlertMetric)) {
    throw new Error("metric is invalid");
  }

  return {
    name: String(body.name ?? ""),
    metric: metric as AlertMetric,
    enabled: Boolean(body.enabled),
    threshold: parseInteger(body.threshold, "threshold"),
    recipient: String(body.recipient ?? ""),
    messageTemplate: String(body.messageTemplate ?? ""),
    botHandlerId: String(body.botHandlerId ?? ""),
    cooldownMinutes: parseInteger(body.cooldownMinutes, "cooldownMinutes"),
  };
};

const validateInput = (input: AlertRuleInput) => {
  if (!input.name.trim()) throw new Error("name is required");
  if (!input.recipient.trim()) throw new Error("recipient is required");
  if (!input.botHandlerId.trim()) throw new Error("bot handler is required");
  if (!input.messageTemplate.trim()) {
    throw new Error("message template is required");
  }
};

export async function GET() {
  try {
    const payload = await getAlertSetupOptions();
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load alerts",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "create");

    if (action === "evaluate") {
      const payload = await evaluateAlertRules({
        force: Boolean(body.force),
      });
      return NextResponse.json(payload, { status: 200 });
    }

    const input = parseInput(body);
    validateInput(input);
    await createAlertRule(input);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create alert",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const input = parseInput(body);
    validateInput(input);
    await updateAlertRule(id, input);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update alert",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteAlertRule(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete alert",
      },
      { status: 500 },
    );
  }
}
