import type {
  ConversationFilterId,
  InboxConversation,
  InboxMessage,
  InboxWhatsAppAccount,
} from "./types";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    timeStyle: "short",
  }).format(date);
}

export function conversationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    open: "Abierta",
    pending: "Pendiente",
    closed: "Cerrada",
    archived: "Archivada",
  };
  return labels[status] ?? status;
}

export function accountStatusLabel(status: string) {
  const labels: Record<string, string> = {
    connected: "Conectado",
    disconnected: "Desconectado",
    connecting: "Conectando",
    pending: "Pendiente",
    qr_required: "Esperando QR",
    failed: "Error",
    disabled: "Deshabilitado",
  };
  return labels[status] ?? status;
}

export function isAccountConnected(status: string | undefined) {
  return status === "connected";
}

export function messageStatusLabel(status: string) {
  const labels: Record<string, string> = {
    sending: "Enviando",
    sent: "Enviado",
    failed: "Fallido",
    received: "Recibido",
    created: "",
    queued: "En cola",
  };
  return labels[status] ?? status;
}

export function digitsPhone(value: string) {
  return value.replace(/\D/g, "");
}

const MESSAGE_URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING_URL_PUNCTUATION = /[.,;:!?)]+]$/;

export type MessageTextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

function trimUrlMatch(raw: string) {
  let value = raw;
  while (value && TRAILING_URL_PUNCTUATION.test(value)) {
    value = value.slice(0, -1);
  }
  return value;
}

export function hrefForMessageUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function splitMessageLinks(text: string): MessageTextPart[] {
  const parts: MessageTextPart[] = [];
  const pattern = new RegExp(MESSAGE_URL_REGEX.source, MESSAGE_URL_REGEX.flags);
  let lastIndex = 0;
  let match = pattern.exec(text);
  while (match) {
    const raw = match[0];
    const url = trimUrlMatch(raw);
    const start = match.index;
    if (start > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, start) });
    }
    if (url) {
      parts.push({
        type: "link",
        value: url,
        href: hrefForMessageUrl(url),
      });
    }
    lastIndex = start + url.length;
    if (raw.length > url.length) {
      lastIndex = start + raw.length;
      const leftover = raw.slice(url.length);
      if (leftover) parts.push({ type: "text", value: leftover });
    }
    match = pattern.exec(text);
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

export function accountPhoneSlug(account: InboxWhatsAppAccount) {
  return digitsPhone(account.phoneNumber ?? "") || account.id;
}

export function accountMatchesSlug(
  account: InboxWhatsAppAccount,
  slug: string,
) {
  const wanted = digitsPhone(slug) || slug;
  return account.id === slug || accountPhoneSlug(account) === wanted;
}

export function mobileListPath(account?: InboxWhatsAppAccount | null) {
  return account
    ? `/conversation-mobile/${accountPhoneSlug(account)}`
    : "/conversation-mobile";
}

export function mobileThreadPath(
  contactPhone: string,
  account?: InboxWhatsAppAccount | null,
) {
  const phone = digitsPhone(contactPhone);
  if (!phone) return mobileListPath(account);
  return account
    ? `/conversation-mobile/${accountPhoneSlug(account)}/${phone}`
    : `/conversation-mobile/${phone}`;
}

export function conversationTitle(conversation: InboxConversation | null) {
  return (
    conversation?.contact?.name ??
    conversation?.contact?.phoneNumber ??
    "Conversacion"
  );
}

export function withLiveAccount(
  conversation: InboxConversation,
  accounts: InboxWhatsAppAccount[],
): InboxConversation {
  const account = accounts.find(
    (item) => item.id === conversation.whatsappAccount?.id,
  );
  if (!account || !conversation.whatsappAccount) return conversation;
  return {
    ...conversation,
    whatsappAccount: {
      ...conversation.whatsappAccount,
      displayName: account.displayName,
      phoneNumber: account.phoneNumber,
      status: account.status,
    },
  };
}

function conversationStamp(conversation: InboxConversation) {
  return (
    conversation.lastMessageAt ??
    conversation.lastMessage?.createdAt ??
    conversation.updatedAt ??
    conversation.createdAt ??
    ""
  );
}

export function sortConversations(items: InboxConversation[]) {
  return [...items].sort((left, right) =>
    conversationStamp(right).localeCompare(conversationStamp(left)),
  );
}

export function sortConversationsUnreadFirst(items: InboxConversation[]) {
  return [...items].sort((left, right) => {
    const leftUnread = left.unreadCount > 0 ? 1 : 0;
    const rightUnread = right.unreadCount > 0 ? 1 : 0;
    if (leftUnread !== rightUnread) return rightUnread - leftUnread;
    return conversationStamp(right).localeCompare(conversationStamp(left));
  });
}

export function upsertConversation(
  items: InboxConversation[],
  next: InboxConversation,
) {
  const exists = items.some((item) => item.id === next.id);
  const merged = exists
    ? items.map((item) => (item.id === next.id ? { ...item, ...next } : item))
    : [next, ...items];
  return sortConversations(merged);
}

export function mergeConversationPatch(
  current: InboxConversation,
  patch: Partial<InboxConversation>,
): InboxConversation {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ),
    contact: patch.contact ?? current.contact,
    whatsappAccount: patch.whatsappAccount
      ? { ...current.whatsappAccount, ...patch.whatsappAccount }
      : current.whatsappAccount,
    assignedUser:
      "assignedUser" in patch
        ? (patch.assignedUser ?? null)
        : current.assignedUser,
    lastMessage: patch.lastMessage ?? current.lastMessage,
  } as InboxConversation;
}

export function sortMessages(items: InboxMessage[]) {
  return [...items].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

export function upsertMessage(items: InboxMessage[], incoming: InboxMessage) {
  const byId = items.findIndex((item) => item.id === incoming.id);
  if (byId >= 0) {
    return sortMessages(
      items.map((item, index) =>
        index === byId ? { ...item, ...incoming, clientKey: undefined } : item,
      ),
    );
  }

  const optimisticIndex = items.findIndex(
    (item) =>
      item.id.startsWith("optimistic:") &&
      item.direction === "outbound" &&
      item.body === incoming.body,
  );
  if (optimisticIndex >= 0 && incoming.direction === "outbound") {
    return sortMessages(
      items.map((item, index) =>
        index === optimisticIndex
          ? { ...incoming, clientKey: item.clientKey }
          : item,
      ),
    );
  }

  return sortMessages([...items, incoming]);
}

export function buildConversationQuery(params: {
  filter: ConversationFilterId;
  search: string;
  accountId: string;
}) {
  const query = new URLSearchParams();
  query.set("pageSize", "100");
  if (params.filter === "open") query.set("status", "open");
  if (params.filter === "closed") query.set("status", "closed");
  if (params.filter === "archived") query.set("status", "archived");
  if (params.filter === "unread") query.set("unread", "true");
  if (params.filter === "mine") query.set("assignedTo", "me");
  if (params.filter === "unassigned") query.set("assignedTo", "unassigned");
  if (params.filter === "blocked") query.set("blocked", "true");
  if (params.accountId !== "all")
    query.set("whatsappAccountId", params.accountId);
  if (params.search.trim()) query.set("search", params.search.trim());
  return query.toString();
}

export function isFullConversation(value: unknown): value is InboxConversation {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && "unreadCount" in record;
}

export function readConversationId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.conversationId === "string") return record.conversationId;
  if (typeof record.id === "string") return record.id;
  return null;
}

export function readMessageFromEvent(value: unknown): InboxMessage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const raw =
    record.message && typeof record.message === "object"
      ? (record.message as Record<string, unknown>)
      : record;
  if (typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    externalMessageId:
      typeof raw.externalMessageId === "string" ? raw.externalMessageId : null,
    direction: typeof raw.direction === "string" ? raw.direction : "unknown",
    type: typeof raw.type === "string" ? raw.type : "text",
    body: typeof raw.body === "string" ? raw.body : null,
    status: typeof raw.status === "string" ? raw.status : "received",
    sentByUser:
      raw.sentByUser && typeof raw.sentByUser === "object"
        ? (raw.sentByUser as InboxMessage["sentByUser"])
        : null,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

export function conversationIdFromPathname(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "main" || parts[1] !== "conversations") return null;
  return parts[2] ?? null;
}

export function pathForConversation(id?: string | null) {
  return id ? `/main/conversations/${id}` : "/main/conversations";
}
