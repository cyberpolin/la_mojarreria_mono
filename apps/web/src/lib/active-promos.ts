export type PromoRegistration = {
  phone: string;
  name: string;
  campaignKey: string;
  status: "active";
  createdAt: string;
  updatedAt: string;
  activatedAt: string;
};

export type ActivePromoContact = {
  phone: string;
  lastText: string;
  lastMessageId: string;
  lastReceivedAt: string;
  messageCount: number;
  registration: PromoRegistration;
};

export type ActivePromosResponse = {
  ok: boolean;
  total: number;
  contacts: ActivePromoContact[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number";

export const isActivePromosResponse = (
  value: unknown,
): value is ActivePromosResponse => {
  if (!isRecord(value)) return false;
  if (value.ok !== true || !isNumber(value.total)) return false;
  if (!Array.isArray(value.contacts)) return false;

  return value.contacts.every((contact) => {
    if (!isRecord(contact) || !isRecord(contact.registration)) return false;

    return (
      isString(contact.phone) &&
      isString(contact.lastText) &&
      isString(contact.lastMessageId) &&
      isString(contact.lastReceivedAt) &&
      isNumber(contact.messageCount) &&
      isString(contact.registration.phone) &&
      isString(contact.registration.name) &&
      isString(contact.registration.campaignKey) &&
      contact.registration.status === "active" &&
      isString(contact.registration.createdAt) &&
      isString(contact.registration.updatedAt) &&
      isString(contact.registration.activatedAt)
    );
  });
};
