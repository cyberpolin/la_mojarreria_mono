"use client";

import { getSessionHeaders } from "@/app/session";
import type { TakuChat, TakuChatMessage } from "./types";

type Role = "superowner" | "client";

type WaConversationMessage = {
  id: string;
  phone: string;
  text: string;
  direction: "inbound" | "outbound";
  timestamp: string;
};

type WaConversation = {
  phone: string;
  lastMessage: WaConversationMessage;
  messageCount: number;
  updatedAt: string;
};

type ConversationsPayload = {
  ok?: boolean;
  conversations?: WaConversation[];
  error?: string;
};

type MessagesPayload = {
  ok?: boolean;
  phone?: string;
  messages?: WaConversationMessage[];
  error?: string;
};

type SendPayload = {
  ok?: boolean;
  phone?: string;
  messageId?: string;
  error?: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_API_BASE_URL ?? "http://localhost:3010";
const apiKey = process.env.NEXT_PUBLIC_TAKU_API_KEY ?? "";
const clientBusinessId = "business_001";

function requestHeaders(role: Role): HeadersInit {
  return {
    "content-type": "application/json",
    ...(apiKey ? { "x-api-key": apiKey } : {}),
    ...getSessionHeaders(),
    "x-taku-role": role,
    "x-taku-business-id": clientBusinessId,
  };
}

async function request<T>(
  path: string,
  role: Role,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...requestHeaders(role),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | T
    | null;

  const isObjectBody = typeof body === "object" && body !== null;
  if (
    !response.ok ||
    !body ||
    (isObjectBody && "ok" in body && body.ok === false)
  ) {
    throw new Error(
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Request failed with ${response.status}`,
    );
  }

  return body as T;
}

function messageStatus(message: WaConversationMessage): "sent" | "delivered" {
  return message.direction === "outbound" ? "sent" : "delivered";
}

export function normalizeMessage(
  message: WaConversationMessage,
): TakuChatMessage {
  return {
    id: `${message.phone}:${message.id}`,
    chatId: message.phone,
    phone: message.phone,
    fromMe: message.direction === "outbound",
    senderName: null,
    senderPhone: message.direction === "outbound" ? null : message.phone,
    body: message.text,
    type: "text",
    mediaUrl: null,
    mimeType: null,
    fileName: null,
    timestamp: message.timestamp,
    status: messageStatus(message),
    raw: message,
  };
}

function normalizeChat(conversation: WaConversation): TakuChat {
  const lastMessage = normalizeMessage(conversation.lastMessage);
  return {
    id: conversation.phone,
    name: `+${conversation.phone}`,
    phone: conversation.phone,
    isGroup: false,
    avatarUrl: null,
    lastMessage,
    lastMessageAt: conversation.updatedAt,
    unreadCount: 0,
    pinned: false,
    archived: false,
    messageCount: conversation.messageCount,
  };
}

export async function listChats(role: Role): Promise<TakuChat[]> {
  const payload = await request<ConversationsPayload>(
    "/v1/wa-chat/conversations?limit=100",
    role,
  );
  return (payload.conversations ?? [])
    .map(normalizeChat)
    .sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      return (right.lastMessageAt ?? "").localeCompare(
        left.lastMessageAt ?? "",
      );
    });
}

export async function listMessages(params: {
  role: Role;
  chatId: string;
}): Promise<TakuChatMessage[]> {
  const payload = await request<MessagesPayload>(
    `/v1/wa-chat/conversations/${encodeURIComponent(params.chatId)}/messages?limit=120`,
    params.role,
  );
  return (payload.messages ?? [])
    .map(normalizeMessage)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export async function sendMessage(params: {
  role: Role;
  chatId: string;
  body: string;
}): Promise<{ messageId: string }> {
  const payload = await request<SendPayload>(
    `/v1/wa-chat/conversations/${encodeURIComponent(params.chatId)}/messages`,
    params.role,
    {
      method: "POST",
      body: JSON.stringify({ text: params.body }),
    },
  );

  return { messageId: payload.messageId ?? `pending-${Date.now()}` };
}
