import { takuApi, takuPaginated } from "@/lib/taku-api";
import { buildConversationQuery } from "./helpers";
import type {
  ConversationFilterId,
  InboxBlockedContact,
  InboxConversation,
  InboxMessage,
} from "./types";

const MESSAGE_PAGE_SIZE = 50;

export async function fetchConversations(params: {
  filter: ConversationFilterId;
  search: string;
  accountId: string;
}) {
  const query = buildConversationQuery(params);
  const result = await takuPaginated<InboxConversation>(
    `/conversations?${query}`,
  );
  return result.items;
}

export async function fetchConversation(conversationId: string) {
  return takuApi<InboxConversation>(`/conversations/${conversationId}`);
}

export async function createConversation(params: {
  phoneNumber: string;
  name?: string;
}) {
  return takuApi<InboxConversation>("/conversations", {
    method: "POST",
    body: JSON.stringify({
      phoneNumber: params.phoneNumber,
      name: params.name,
    }),
  });
}

export async function fetchConversationByPhone(phoneNumber: string) {
  const query = new URLSearchParams({
    phone: phoneNumber,
    pageSize: "20",
  });
  const result = await takuPaginated<InboxConversation>(
    `/conversations?${query.toString()}`,
  );
  return result.items[0] ?? null;
}

async function fetchMessagePage(params: {
  conversationId: string;
  page: number;
  before?: string;
}) {
  const query = new URLSearchParams();
  query.set("pageSize", String(MESSAGE_PAGE_SIZE));
  query.set("page", String(params.page));
  if (params.before) query.set("before", params.before);
  return takuPaginated<InboxMessage>(
    `/conversations/${params.conversationId}/messages?${query.toString()}`,
  );
}

export async function fetchNewestMessages(
  conversationId: string,
  before?: string,
) {
  const first = await fetchMessagePage({
    conversationId,
    page: 1,
    before,
  });
  const lastPage =
    first.pagination.totalPages > 1
      ? await fetchMessagePage({
          conversationId,
          page: first.pagination.totalPages,
          before,
        })
      : first;
  return {
    items: lastPage.items,
    hasMore:
      first.pagination.totalPages > 1 ||
      first.pagination.total > first.pagination.pageSize,
  };
}

export async function sendConversationMessage(
  conversationId: string,
  body: string,
) {
  return takuApi<InboxMessage>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ type: "text", body }),
  });
}

export async function markConversationRead(conversationId: string) {
  return takuApi<{ id: string; unreadCount: number; updatedAt: string }>(
    `/conversations/${conversationId}/read`,
    { method: "POST" },
  );
}

export async function updateConversationAssignment(
  conversationId: string,
  assignedUserId: string | null,
) {
  return takuApi<{
    id: string;
    assignedUser: { id: string; name: string } | null;
    updatedAt: string;
  }>(`/conversations/${conversationId}/assignment`, {
    method: "PATCH",
    body: JSON.stringify({ assignedUserId }),
  });
}

export async function updateConversationStatus(
  conversationId: string,
  status: "open" | "pending" | "closed" | "archived",
) {
  return takuApi<{ id: string; status: string; updatedAt: string }>(
    `/conversations/${conversationId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export async function updateContact(
  contactId: string,
  values: { name: string; notes: string },
) {
  return takuApi<InboxConversation["contact"]>(`/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export async function createAutomationBlock(params: {
  phoneNumber: string;
  label: string;
  enabled: boolean;
}) {
  return takuApi<InboxBlockedContact>("/automation-blocked-contacts", {
    method: "POST",
    body: JSON.stringify({
      phoneNumber: params.phoneNumber,
      label: params.label,
      reason: "Bloqueado desde conversaciones",
      enabled: params.enabled,
    }),
  });
}

export async function updateAutomationBlock(blockId: string, enabled: boolean) {
  return takuApi<InboxBlockedContact>(
    `/automation-blocked-contacts/${blockId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    },
  );
}
