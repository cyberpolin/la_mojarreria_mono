type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type DeepSeekConfig = {
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
  deepseekTemperature: number;
  deepseekMaxTokens: number;
};

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class DeepSeekProviderError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(params: { status: number; responseBody: string }) {
    super(`DeepSeek request failed with status ${params.status}`);
    this.name = "DeepSeekProviderError";
    this.status = params.status;
    this.responseBody = params.responseBody;
  }
}

export async function createDeepSeekReply(params: {
  config: DeepSeekConfig;
  messages: ChatMessage[];
}): Promise<string> {
  const response = await fetch(
    `${params.config.deepseekBaseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${params.config.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: params.config.deepseekModel,
        messages: params.messages,
        temperature: params.config.deepseekTemperature,
        max_tokens: params.config.deepseekMaxTokens,
      }),
    },
  );

  const bodyText = await response.text();
  let body: DeepSeekChatResponse | null = null;

  if (bodyText) {
    try {
      body = JSON.parse(bodyText) as DeepSeekChatResponse;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new DeepSeekProviderError({
      status: response.status,
      responseBody: bodyText,
    });
  }

  const reply = body?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("DeepSeek response did not include reply text");
  }

  return reply;
}
