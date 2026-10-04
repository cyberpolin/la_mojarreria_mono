export type FaqAutoReplyIntent = "horarios" | "ubicacion" | "envio";

export const FAQ_AUTO_REPLY_INTENTS: FaqAutoReplyIntent[] = [
  "horarios",
  "ubicacion",
  "envio",
];

export const FAQ_AUTO_REPLY_DEFAULTS: Record<
  FaqAutoReplyIntent,
  { title: string; phrases: string[]; responseText: string }
> = {
  horarios: {
    title: "Horarios de atencion",
    phrases: [
      "horario de atencion",
      "a que hora abren",
      "a que hora cierran",
      "cuando abren",
      "cuando cierran",
      "siguen abiertos",
      "ya cerraron",
      "estan abiertos",
      "horario",
      "dias de atencion",
    ],
    responseText: "",
  },
  ubicacion: {
    title: "Ubicacion",
    phrases: [
      "donde estan",
      "donde queda",
      "como llego",
      "ubicacion",
      "direccion",
      "sucursal",
    ],
    responseText: "",
  },
  envio: {
    title: "Costos de envio",
    phrases: [
      "costo envio",
      "precio envio",
      "cuanto cuesta el envio",
      "cuanto es el envio",
      "hacen envios",
      "delivery",
      "a domicilio",
    ],
    responseText: "",
  },
};

export function isFaqAutoReplyIntent(
  value: string,
): value is FaqAutoReplyIntent {
  return FAQ_AUTO_REPLY_INTENTS.includes(value as FaqAutoReplyIntent);
}

export function normalizeFaqPhrase(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function parseThreshold(value: unknown, fallback = 80) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(100, Math.round(parsed)));
}

function scorePhrase(text: string, phrase: string) {
  const needle = normalizeFaqPhrase(phrase);
  if (needle.length < 3) return 0;
  if (text === needle) return 100;
  if (text.includes(needle)) {
    return clampScore(70 + (needle.length / text.length) * 30);
  }
  const words = needle.split(" ").filter((word) => word.length >= 2);
  if (words.length === 0) return 0;
  let cursor = 0;
  let found = 0;
  for (const word of words) {
    const at = text.indexOf(word, cursor);
    if (at === -1) continue;
    found += 1;
    cursor = at + word.length;
  }
  if (found === 0) return 0;
  const ratio = found / words.length;
  if (ratio === 1) return 80;
  return clampScore(ratio * 70);
}

export function scoreReplyAcceptance(text: string, phrases: string[]) {
  const normalized = normalizeFaqPhrase(text);
  if (!normalized) return 0;
  const hits = phrases
    .map((phrase) => scorePhrase(normalized, phrase))
    .filter((score) => score > 0);
  if (hits.length === 0) return 0;
  const miss = hits.reduce((product, score) => product * (1 - score / 100), 1);
  return clampScore(Math.max(...hits, (1 - miss) * 100));
}

export const FAQ_AUTO_REPLY_WINDOW = 3;

export function unansweredInboundWindow<
  T extends {
    direction: string;
    body?: string | null;
    createdAt: string;
  },
>(messages: T[]) {
  const sorted = [...messages].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const tail: T[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const message = sorted[index];
    if (message.direction === "outbound" || message.direction === "bot") break;
    if (message.direction === "inbound" && message.body?.trim()) {
      tail.unshift(message);
    }
    if (tail.length >= FAQ_AUTO_REPLY_WINDOW) break;
  }
  return tail;
}

export function findMatchingFaqAutoReply<
  T extends {
    workspaceId: string;
    phrases: string[];
    responseText: string;
    enabled: boolean;
    threshold?: number;
  },
>(replies: T[], workspaceId: string, incomingText: string) {
  const text = normalizeFaqPhrase(incomingText);
  if (!text) return null;
  let best: { reply: T; score: number } | null = null;
  for (const reply of replies) {
    if (reply.workspaceId !== workspaceId) continue;
    if (!reply.enabled || !reply.responseText.trim()) continue;
    const score = scoreReplyAcceptance(incomingText, reply.phrases);
    const threshold = parseThreshold(reply.threshold);
    if (score < threshold) continue;
    if (!best || score > best.score) best = { reply, score };
  }
  return best?.reply ?? null;
}

export function parsePhrases(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const phrase = item.trim().replace(/\s+/g, " ");
    const key = phrase.toLowerCase();
    if (!phrase || seen.has(key)) continue;
    seen.add(key);
    phrases.push(phrase);
  }
  return phrases;
}
