import { z } from "zod";

const phoneSchema = z.string().min(10).max(20);

export function normalizePhone(rawPhone: string): string {
  const trimmed = phoneSchema.parse(rawPhone.trim());
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    throw new Error("Phone number must contain 10 to 15 digits");
  }

  if (digits.length === 10) {
    return `521${digits}`;
  }

  if (
    digits.startsWith("52") &&
    !digits.startsWith("521") &&
    digits.length === 12
  ) {
    return `521${digits.slice(2)}`;
  }

  return digits;
}

export function phoneToWhatsAppJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

export function isGroupJid(value: string) {
  return value.trim().toLowerCase().endsWith("@g.us");
}

export function chatJidFromRecipient(to: string): string {
  const trimmed = to.trim();
  if (isGroupJid(trimmed)) return trimmed;
  return phoneToWhatsAppJid(trimmed);
}

export function phoneFromWhatsAppJid(jid: string): string | null {
  if (!jid.endsWith("@s.whatsapp.net")) {
    return null;
  }

  const [user] = jid.split("@");
  if (!user) {
    return null;
  }

  const phone = user.split(":")[0];
  if (!phone) {
    return null;
  }

  try {
    return normalizePhone(phone);
  } catch {
    return null;
  }
}

export function digitsFromWhatsAppId(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || isGroupJid(trimmed)) return null;
  const user = trimmed.split("@")[0]?.split(":")[0] ?? "";
  const digits = user.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 15) return digits;
  return phoneFromWhatsAppJid(trimmed);
}
