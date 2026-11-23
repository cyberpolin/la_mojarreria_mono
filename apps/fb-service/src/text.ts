export function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function readStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: string[] = [];
  for (const entry of value) {
    const text = readString(entry);
    if (!text || items.includes(text)) {
      continue;
    }
    items.push(text);
    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

export function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return toIsoTimestamp(Number(trimmed));
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < leftBuffer.length; index += 1) {
    mismatch |= (leftBuffer[index] ?? 0) ^ (rightBuffer[index] ?? 0);
  }

  return mismatch === 0;
}
