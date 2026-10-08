import { TakuApiError, takuApi, takuPaginated } from "@/lib/taku-api";
import { persistLocalFaqAutoReplies } from "./autoReplies";
import {
  buildConversationQuery,
  normalizeDriversGroupMode,
  isTestDriversGroupConversation,
  type DriversGroupMode,
} from "./helpers";
import type {
  ConversationFilterId,
  InboxBlockedContact,
  InboxConversation,
  InboxMessage,
  InboxWhatsAppAccount,
} from "./types";

const MESSAGE_PAGE_SIZE = 50;

export async function fetchConversations(params: {
  filter: ConversationFilterId;
  search: string;
  accountId: string;
}) {
  await persistLocalFaqAutoReplies();
  const query = buildConversationQuery(params);
  const result = await takuPaginated<InboxConversation>(
    `/conversations?${query}`,
  );
  return result.items;
}

export async function fetchDriversGroupMode(): Promise<DriversGroupMode> {
  const preferences = await takuApi<{ driversGroupMode?: string } | null>(
    "/preferences",
  );
  return normalizeDriversGroupMode(preferences?.driversGroupMode);
}

export async function updateDriversGroupMode(mode: DriversGroupMode) {
  return takuApi<{
    message: string;
    preferences: { driversGroupMode?: string };
  }>("/preferences", {
    method: "PATCH",
    body: JSON.stringify({ driversGroupMode: mode }),
  });
}

export async function fetchPinnedGroupConversation(accountId?: string) {
  const mode = await fetchDriversGroupMode();
  const scoped = await fetchConversations({
    filter: "all",
    search: "",
    accountId: accountId ?? "all",
  });
  const pinned = scoped.filter(
    (item) => item.pinned && (item.isGroup || item.contact?.kind === "group"),
  );
  const pick = (rows: InboxConversation[]) =>
    mode === "prod"
      ? (rows.find((item) => !isTestDriversGroupConversation(item)) ?? null)
      : (rows.find((item) => isTestDriversGroupConversation(item)) ?? null);
  const selected = pick(pinned);
  if (selected || !accountId || accountId === "all") return selected;
  const all = await fetchConversations({
    filter: "all",
    search: "",
    accountId: "all",
  });
  return pick(
    all.filter(
      (item) => item.pinned && (item.isGroup || item.contact?.kind === "group"),
    ),
  );
}

export async function fetchConversation(conversationId: string) {
  return takuApi<InboxConversation>(`/conversations/${conversationId}`);
}

export async function fetchWhatsAppAccounts() {
  const result = await takuPaginated<InboxWhatsAppAccount>(
    "/whatsapp-accounts?pageSize=100",
  );
  return result.items.filter(
    (account) => account.status !== "disabled" && account.enabled !== false,
  );
}

export async function createConversation(params: {
  phoneNumber: string;
  name?: string;
  whatsappAccountId?: string;
}) {
  return takuApi<InboxConversation>("/conversations", {
    method: "POST",
    body: JSON.stringify({
      phoneNumber: params.phoneNumber,
      name: params.name,
      whatsappAccountId: params.whatsappAccountId,
    }),
  });
}

export type WhatsAppGroupOption = {
  id: string;
  subject: string;
  size: number;
  added: boolean;
  pinned?: boolean;
};

export async function pinConversation(conversationId: string, pinned: boolean) {
  return takuApi<InboxConversation>(`/conversations/${conversationId}/pin`, {
    method: "PATCH",
    body: JSON.stringify({ pinned }),
  });
}

export async function fetchAccountGroups(accountId: string) {
  return takuApi<WhatsAppGroupOption[]>(
    `/whatsapp-accounts/${accountId}/groups`,
  );
}

export async function addGroupConversation(params: {
  whatsappAccountId: string;
  groupJid: string;
  name?: string;
  role?: "prod" | "test";
}) {
  return takuApi<InboxConversation>("/conversations/groups", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchConversationByPhone(
  phoneNumber: string,
  accountId?: string,
) {
  const query = new URLSearchParams({
    phone: phoneNumber,
    pageSize: "20",
  });
  if (accountId) query.set("whatsappAccountId", accountId);
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

export async function fetchBlockedContacts() {
  const result = await takuPaginated<InboxBlockedContact>(
    "/automation-blocked-contacts?pageSize=100",
  );
  return result.items.filter((item) => item.enabled);
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

export type WeekCloseRecord = {
  id: string;
  weekStart: string;
  weekEnd: string;
  mojarrasBought: number;
  mojarraKg: number;
  kgCost: number;
  platosPerMojarra: number;
  gasPerMojarra: number;
  aceite: number;
  raya: number;
  publi: number;
  comidaVerduras: number;
  otros: number;
  ingresos: number;
  mojarrasVendidas: number;
  mojarraCost: number;
  platos: number;
  gas: number;
  gastos: number;
  neto: number;
  updatedAt: string;
};

export type WeekClosePayload = {
  mojarrasBought: number;
  mojarraKg: number;
  kgCost: number;
  platosPerMojarra: number;
  gasPerMojarra: number;
  aceite: number;
  raya: number;
  publi: number;
  comidaVerduras: number;
  otros: number;
  ingresos: number;
  mojarrasVendidas: number;
};

export async function fetchWeekCloses() {
  return takuApi<WeekCloseRecord[]>("/week-closes");
}

export async function fetchWeekClose(weekStart: string) {
  try {
    return await takuApi<WeekCloseRecord>(`/week-closes/${weekStart}`);
  } catch (error) {
    if (error instanceof TakuApiError && error.status === 404) return null;
    throw error;
  }
}

export async function saveWeekClose(
  weekStart: string,
  payload: WeekClosePayload,
) {
  return takuApi<WeekCloseRecord>(`/week-closes/${weekStart}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export type DayCloseRecord = {
  id: string;
  dayKey: string;
  expectedEfectivo: number;
  expectedBanco: number;
  expectedTotal: number;
  countedEfectivo: number;
  countedBanco: number;
  extraGastos: number;
  diferencia: number;
  orderCount: number;
  mojarras: number;
  empanadas: number;
  updatedAt: string;
};

export type DayClosePayload = {
  expectedEfectivo: number;
  expectedBanco: number;
  expectedTotal: number;
  countedEfectivo: number;
  countedBanco: number;
  extraGastos: number;
  orderCount: number;
  mojarras: number;
  empanadas: number;
};

export async function fetchDayCloses() {
  return takuApi<DayCloseRecord[]>("/day-closes");
}

export async function fetchDayClose(dayKey: string) {
  try {
    return await takuApi<DayCloseRecord>(`/day-closes/${dayKey}`);
  } catch (error) {
    if (error instanceof TakuApiError && error.status === 404) return null;
    throw error;
  }
}

export async function saveDayClose(dayKey: string, payload: DayClosePayload) {
  return takuApi<DayCloseRecord>(`/day-closes/${dayKey}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export type AttendancePunchRecord = {
  id: string;
  whatsappAccountId: string;
  employeeId: string;
  employeeName: string;
  phoneNumber: string;
  type: "entrada" | "salida";
  dayKey: string;
  createdAt: string;
};

export async function fetchAttendancePunches(whatsappAccountId: string) {
  const query = new URLSearchParams({ whatsappAccountId });
  return takuApi<AttendancePunchRecord[]>(`/attendance/punches?${query}`);
}

export async function punchAttendance(params: {
  whatsappAccountId: string;
  phoneNumber: string;
  pin: string;
}) {
  return takuApi<AttendancePunchRecord>("/attendance/punches", {
    method: "POST",
    body: JSON.stringify({
      whatsappAccountId: params.whatsappAccountId,
      phoneNumber: params.phoneNumber,
      pin: params.pin,
    }),
  });
}

export async function setWhatsAppTimeClock(
  accountId: string,
  timeClockEnabled: boolean,
) {
  return takuApi<InboxWhatsAppAccount>(`/whatsapp-accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify({ timeClockEnabled }),
  });
}
