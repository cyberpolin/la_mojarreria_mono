import { NextRequest, NextResponse } from "next/server";
import {
  createBotHandler,
  deleteBotHandler,
  getBotHandlers,
  testBotHandlerWebhook,
  updateBotHandler,
} from "@/lib/bot-handlers";
import { BotHandlerInput, BotHandlerProvider } from "@/types/bot-handler";

const providers = new Set<BotHandlerProvider>([
  "WHATSAPP",
  "OPENAI",
  "CUSTOM_WEBHOOK",
]);

const parseSettings = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("settings must be a JSON object");
  }
  return parsed as Record<string, unknown>;
};

const parseInput = (body: Record<string, unknown>): BotHandlerInput => {
  const provider = String(body.provider ?? "CUSTOM_WEBHOOK");
  if (!providers.has(provider as BotHandlerProvider)) {
    throw new Error("provider is invalid");
  }

  return {
    name: String(body.name ?? ""),
    provider: provider as BotHandlerProvider,
    enabled: Boolean(body.enabled),
    baseUrl: String(body.baseUrl ?? ""),
    webhookUrl: String(body.webhookUrl ?? ""),
    apiKeySecret: String(body.apiKeySecret ?? ""),
    settings: parseSettings(body.settings),
  };
};

export async function GET() {
  try {
    const payload = await getBotHandlers();
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load handlers",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "create");

    if (action === "test") {
      const webhookUrl = String(body.webhookUrl ?? "").trim();
      if (!webhookUrl) {
        return NextResponse.json(
          { error: "webhookUrl is required" },
          { status: 400 },
        );
      }
      const result = await testBotHandlerWebhook(webhookUrl);
      return NextResponse.json(result, { status: 200 });
    }

    const input = parseInput(body);
    if (!input.name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    await createBotHandler(input);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create handler",
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
    if (!input.name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    await updateBotHandler(id, input);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update handler",
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

    await deleteBotHandler(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete handler",
      },
      { status: 500 },
    );
  }
}
