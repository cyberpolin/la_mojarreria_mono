export const WA_API_BASE_URL = (
  process.env.MOJARRERIA_WA_API_BASE_URL ?? "https://api.wa.lamojarreria.com"
).replace(/\/+$/, "");
export const WA_API_KEY = process.env.MOJARRERIA_WA_API_KEY;
export const WA_CLIENT_DOMAIN =
  process.env.MOJARRERIA_WA_CLIENT_DOMAIN ?? "lamojarreria.com";

export const BOT_API_BASE_URL = (
  process.env.MOJARRERIA_BOT_API_BASE_URL ?? "https://api.bot.lamojarreria.com"
).replace(/\/+$/, "");
export const BOT_API_KEY = process.env.MOJARRERIA_BOT_API_KEY;

export function missingConfigResponse(name: string) {
  return Response.json(
    { ok: false, error: `${name} is required.` },
    { status: 500 },
  );
}
