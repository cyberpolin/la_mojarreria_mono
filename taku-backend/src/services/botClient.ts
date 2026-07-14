import { config } from "../config.js";

async function request(path: string, init?: RequestInit): Promise<unknown> {
  if (!config.botServiceApiKey) return null;
  const response = await fetch(
    `${config.botServiceBaseUrl.replace(/\/+$/, "")}${path}`,
    {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.botServiceApiKey}`,
        "x-api-key": config.botServiceApiKey,
        ...(init?.headers ?? {}),
      },
    },
  );
  return response.json().catch(() => null);
}

export const botClient = {
  syncSettings(payload: Record<string, unknown>) {
    return request("/bot/settings/sync", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  evaluateAfterHours(payload: Record<string, unknown>) {
    return request("/bot/evaluate/after-hours", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  evaluateRules(payload: Record<string, unknown>) {
    return request("/bot/evaluate/rules", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  generateReply(payload: Record<string, unknown>) {
    return request("/bot/generate-reply", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
