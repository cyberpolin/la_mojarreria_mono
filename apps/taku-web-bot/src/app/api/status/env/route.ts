import { NextResponse } from "next/server";

function mask(value: string | undefined) {
  if (!value) return null;
  return value.length <= 8
    ? `${value.slice(0, 2)}...`
    : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function GET() {
  const botApiBaseUrl =
    process.env.TAKU_BOT_API_BASE_URL ?? "http://localhost:3002";
  const botApiKey = process.env.TAKU_BOT_API_KEY;
  const mercadoPagoPublicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
  const superadminEmail = process.env.TAKU_BOT_SUPERADMIN_EMAIL;
  const superadminPassword = process.env.TAKU_BOT_SUPERADMIN_PASSWORD;

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    variables: [
      {
        name: "TAKU_BOT_API_BASE_URL",
        configured: Boolean(botApiBaseUrl),
        value: botApiBaseUrl,
        required: true,
      },
      {
        name: "TAKU_BOT_API_KEY",
        configured: Boolean(botApiKey),
        maskedValue: mask(botApiKey),
        required: true,
      },
      {
        name: "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY",
        configured: Boolean(mercadoPagoPublicKey),
        maskedValue: mask(mercadoPagoPublicKey),
        required: true,
      },
      {
        name: "TAKU_BOT_SUPERADMIN_EMAIL",
        configured: Boolean(superadminEmail),
        maskedValue: mask(superadminEmail),
        required: true,
      },
      {
        name: "TAKU_BOT_SUPERADMIN_PASSWORD",
        configured: Boolean(superadminPassword),
        maskedValue: mask(superadminPassword),
        required: true,
      },
    ],
  });
}
