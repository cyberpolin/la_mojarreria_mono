import { NextResponse } from "next/server";

const botApiBaseUrl =
  process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
const botApiKey = process.env.TAKU_BOT_API_KEY ?? "";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    assistantId?: unknown;
    message?: unknown;
  } | null;
  const assistantId =
    typeof body?.assistantId === "string" && body.assistantId.trim()
      ? body.assistantId.trim()
      : undefined;
  const message =
    typeof body?.message === "string" && body.message.trim()
      ? body.message.trim()
      : "Reply with exactly: bot-ok";
  const response = await fetch(
    `${botApiBaseUrl.replace(/\/+$/, "")}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${botApiKey}`,
      },
      body: JSON.stringify({
        model: "taku-cr",
        assistant_id: assistantId,
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
      }),
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    model?: string;
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
    error?: {
      message?: string;
    };
  } | null;

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: payload?.error?.message ?? "Bot provider unavailable",
      },
      { status: response.status },
    );
  }

  return NextResponse.json({
    ok: true,
    model: payload?.model ?? "unknown",
    reply: {
      text: payload?.choices?.[0]?.message?.content ?? "",
    },
  });
}
