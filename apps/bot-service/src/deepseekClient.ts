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
    finish_reason?: string;
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type ChatUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type ChatReply = {
  text: string;
  usage: ChatUsage;
};

export type DeepSeekResponseSummary = {
  parsedJson: boolean;
  topLevelKeys: string[];
  choiceCount: number | null;
  firstChoiceKeys: string[];
  firstChoiceFinishReason: string | null;
  firstChoiceMessageKeys: string[];
  hasContent: boolean;
  contentLength: number | null;
  usageKeys: string[];
  bodyLength: number;
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

export class DeepSeekInvalidResponseError extends Error {
  readonly responseSummary: DeepSeekResponseSummary;

  constructor(params: { responseSummary: DeepSeekResponseSummary }) {
    super("DeepSeek response did not include reply text");
    this.name = "DeepSeekInvalidResponseError";
    this.responseSummary = params.responseSummary;
  }
}

function objectKeys(value: unknown): string[] {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).sort()
    : [];
}

function summarizeResponse(params: {
  body: DeepSeekChatResponse | null;
  bodyText: string;
}): DeepSeekResponseSummary {
  const firstChoice = params.body?.choices?.[0];
  const content =
    typeof firstChoice?.message?.content === "string"
      ? firstChoice.message.content
      : null;

  return {
    parsedJson: Boolean(params.body),
    topLevelKeys: objectKeys(params.body),
    choiceCount: Array.isArray(params.body?.choices)
      ? params.body.choices.length
      : null,
    firstChoiceKeys: objectKeys(firstChoice),
    firstChoiceFinishReason:
      typeof firstChoice?.finish_reason === "string"
        ? firstChoice.finish_reason
        : null,
    firstChoiceMessageKeys: objectKeys(firstChoice?.message),
    hasContent: typeof content === "string" && content.trim().length > 0,
    contentLength: typeof content === "string" ? content.length : null,
    usageKeys: objectKeys(params.body?.usage),
    bodyLength: params.bodyText.length,
  };
}

export async function createDeepSeekReply(params: {
  config: DeepSeekConfig;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
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
        model: params.model ?? params.config.deepseekModel,
        messages: params.messages,
        temperature: params.temperature ?? params.config.deepseekTemperature,
        max_tokens: params.maxTokens ?? params.config.deepseekMaxTokens,
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
    throw new DeepSeekInvalidResponseError({
      responseSummary: summarizeResponse({ body, bodyText }),
    });
  }

  return reply;
}

export async function createDeepSeekChatReply(params: {
  config: DeepSeekConfig;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<ChatReply> {
  const response = await fetch(
    `${params.config.deepseekBaseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${params.config.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: params.model ?? params.config.deepseekModel,
        messages: params.messages,
        temperature: params.temperature ?? params.config.deepseekTemperature,
        max_tokens: params.maxTokens ?? params.config.deepseekMaxTokens,
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
    throw new DeepSeekInvalidResponseError({
      responseSummary: summarizeResponse({ body, bodyText }),
    });
  }

  return {
    text: reply,
    usage: {
      promptTokens:
        typeof body?.usage?.prompt_tokens === "number"
          ? body.usage.prompt_tokens
          : null,
      completionTokens:
        typeof body?.usage?.completion_tokens === "number"
          ? body.usage.completion_tokens
          : null,
      totalTokens:
        typeof body?.usage?.total_tokens === "number"
          ? body.usage.total_tokens
          : null,
    },
  };
}
