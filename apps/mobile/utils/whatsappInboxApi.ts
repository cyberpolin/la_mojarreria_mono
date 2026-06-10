import { APP_CONFIG } from "@/constants/config";

export type WhatsAppConversationMessage = {
  id: string;
  phone: string;
  text: string;
  direction: "inbound" | "outbound";
  timestamp: string;
};

export type WhatsAppConversation = {
  phone: string;
  lastMessage: WhatsAppConversationMessage;
  messageCount: number;
  updatedAt: string;
};

const baseUrl = (APP_CONFIG.waApiBaseUrl || "").replace(/\/+$/, "");

const headers = {
  "content-type": "application/json",
  "x-api-key": APP_CONFIG.waApiKey,
  "x-client-domain": APP_CONFIG.waClientDomain,
};

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error || `WA service request failed`);
  }

  return payload;
}

export async function fetchWhatsAppConversations(limit = 50): Promise<{
  conversations: WhatsAppConversation[];
}> {
  const response = await fetch(`${baseUrl}/v1/conversations?limit=${limit}`, {
    method: "GET",
    headers,
  });

  return parseResponse<{ ok: true; conversations: WhatsAppConversation[] }>(
    response,
  );
}

export async function fetchWhatsAppMessages(params: {
  phone: string;
  limit?: number;
}): Promise<{ messages: WhatsAppConversationMessage[] }> {
  const response = await fetch(
    `${baseUrl}/v1/conversations/${encodeURIComponent(params.phone)}/messages?limit=${
      params.limit ?? 80
    }`,
    {
      method: "GET",
      headers,
    },
  );

  return parseResponse<{ ok: true; messages: WhatsAppConversationMessage[] }>(
    response,
  );
}

export async function sendWhatsAppConversationMessage(params: {
  phone: string;
  text: string;
}): Promise<{ messageId: string }> {
  const response = await fetch(
    `${baseUrl}/v1/conversations/${encodeURIComponent(params.phone)}/messages`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ text: params.text }),
    },
  );

  return parseResponse<{ ok: true; messageId: string }>(response);
}
