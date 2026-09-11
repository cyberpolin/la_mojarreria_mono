export type ConversationStatus = "open" | "pending" | "closed" | "archived";

export type ConversationFilterId =
  | "all"
  | "open"
  | "unread"
  | "mine"
  | "unassigned"
  | "closed"
  | "archived";

export type WhatsAppAccountStatus =
  | "pending"
  | "qr_required"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "disabled";

export type InboxWhatsAppAccount = {
  id: string;
  displayName: string;
  phoneNumber: string | null;
  status: string;
  enabled?: boolean;
};

export type InboxContact = {
  id: string;
  name: string | null;
  phoneNumber: string;
  notes?: string | null;
  profilePictureUrl?: string | null;
};

export type InboxConversation = {
  id: string;
  status: string;
  contact: InboxContact | null;
  whatsappAccount: InboxWhatsAppAccount | null;
  assignedUser: { id: string; name: string } | null;
  lastMessage: {
    body: string | null;
    direction: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type InboxMessage = {
  id: string;
  externalMessageId?: string | null;
  direction: string;
  type?: string;
  body: string | null;
  status: string;
  sentByUser?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt?: string;
  clientKey?: string;
};

export type InboxUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

export type InboxBlockedContact = {
  id: string;
  phoneNumber: string;
  label: string | null;
  reason: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConversationPatch = Partial<InboxConversation> & {
  id: string;
};

export type RealtimeEnvelope = {
  event?: string;
  data?: unknown;
};
