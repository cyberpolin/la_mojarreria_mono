export type BotHandlerProvider = "WHATSAPP" | "OPENAI" | "CUSTOM_WEBHOOK";

export type BotHandlerConfigRecord = {
  id: string;
  name: string;
  provider: BotHandlerProvider;
  enabled: boolean;
  baseUrl: string | null;
  webhookUrl: string | null;
  hasApiKeySecret: boolean;
  settings: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};

export type BotHandlersPayload = {
  handlers: BotHandlerConfigRecord[];
};

export type BotHandlerInput = {
  name: string;
  provider: BotHandlerProvider;
  enabled: boolean;
  baseUrl?: string;
  webhookUrl?: string;
  apiKeySecret?: string;
  settings?: Record<string, unknown>;
};
