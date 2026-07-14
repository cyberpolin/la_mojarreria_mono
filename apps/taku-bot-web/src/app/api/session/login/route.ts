import { NextResponse } from "next/server";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function readCredentials(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as LoginBody;
  return typeof record.email === "string" && typeof record.password === "string"
    ? {
        email: record.email.trim(),
        password: record.password,
      }
    : null;
}

function accountNameFromEmail(email: string) {
  return email.split("@")[0] || "Bot user";
}

export async function POST(request: Request) {
  const credentials = readCredentials(await request.json().catch(() => null));
  if (!credentials?.email || !credentials.password) {
    return NextResponse.json(
      { ok: false, error: "Email and password are required." },
      { status: 400 },
    );
  }

  const superadminEmail = process.env.TAKU_BOT_SUPERADMIN_EMAIL?.trim();
  const superadminPassword = process.env.TAKU_BOT_SUPERADMIN_PASSWORD;
  const isSuperadminEmail =
    Boolean(superadminEmail) &&
    credentials.email.toLowerCase() === superadminEmail?.toLowerCase();
  const isSuperadmin =
    Boolean(isSuperadminEmail && superadminPassword) &&
    credentials.password === superadminPassword;

  if (isSuperadminEmail && !isSuperadmin) {
    return NextResponse.json(
      { ok: false, error: "Invalid superadmin password." },
      { status: 401 },
    );
  }

  const role = isSuperadmin ? "superadmin" : "client_user";
  const accountName = accountNameFromEmail(credentials.email);

  return NextResponse.json({
    ok: true,
    session: {
      account: {
        id: `${role}_${Buffer.from(credentials.email)
          .toString("base64url")
          .slice(0, 16)}`,
        name: accountName,
        email: credentials.email,
        projectName: isSuperadmin
          ? "TAKU Bot Superadmin"
          : "TAKU Bot workspace",
        plan: isSuperadmin ? "superadmin" : "free",
        role,
      },
      bot: {
        id: `bot_${Date.now()}`,
        name: "Customer assistant",
      },
      createdAt: new Date().toISOString(),
    },
  });
}
