export type TakuChatMessageStatus = "sent" | "delivered" | "read" | "error";

export type TakuChatMessageType =
  | "text"
  | "image"
  | "audio"
  | "document"
  | "video";

export type TakuChatMessage = {
  id: string;
  chatId: string;
  phone: string;
  fromMe: boolean;
  senderName: string | null;
  senderPhone: string | null;
  body: string;
  type: TakuChatMessageType;
  mediaUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
  timestamp: string;
  status: TakuChatMessageStatus;
  raw: unknown;
};

export type TakuChat = {
  id: string;
  name: string;
  phone: string;
  isGroup: boolean;
  avatarUrl: string | null;
  lastMessage: TakuChatMessage | null;
  lastMessageAt: string | null;
  unreadCount: number;
  pinned: boolean;
  archived: boolean;
  messageCount: number;
};

export type SyncState = "connected" | "syncing" | "reconnecting" | "offline";
