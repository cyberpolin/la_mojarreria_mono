import { todayDateKey } from "./weekClose.js";

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

const SYSTEM_PATTERNS: Record<
  FaqAutoReplyIntent,
  Array<{ re: RegExp; weight: number }>
> = {
  horarios: [
    { re: /horario(?:s)? de atencion/, weight: 75 },
    { re: /fuera de horario/, weight: 70 },
    { re: /a que hora (?:abren|cierran|atienden)/, weight: 75 },
    { re: /hasta que hora/, weight: 70 },
    { re: /que hora/, weight: 55 },
    { re: /cuando (?:abren|cierran|atienden)/, weight: 70 },
    { re: /siguen abiertos?/, weight: 65 },
    { re: /ya cerraron/, weight: 60 },
    { re: /estan abiertos?/, weight: 60 },
    { re: /horario(?:s)?/, weight: 55 },
    { re: /\b(?:abren|cierran|atienden)\b/, weight: 40 },
    { re: /dias? de atencion/, weight: 65 },
  ],
  ubicacion: [
    { re: /donde (?:estan|queda|quedan|se ubican)/, weight: 75 },
    { re: /en donde (?:estan|queda|quedan)/, weight: 75 },
    { re: /como llego/, weight: 70 },
    { re: /cual es la (?:direccion|ubicacion)/, weight: 75 },
    { re: /me pasan? la (?:ubicacion|direccion)/, weight: 70 },
    { re: /ubicacion/, weight: 60 },
    { re: /direccion/, weight: 50 },
    { re: /sucursal/, weight: 45 },
    { re: /\bmapa\b/, weight: 40 },
    { re: /donde quedan?/, weight: 70 },
  ],
  envio: [
    { re: /costo(?:s)?(?:\s+\w+){0,2}\s+envio/, weight: 80 },
    { re: /precio(?:s)?(?:\s+\w+){0,2}\s+envio/, weight: 80 },
    { re: /cuanto (?:cuesta|sale|es) (?:el )?envio/, weight: 80 },
    { re: /cuanto (?:el )?envio/, weight: 75 },
    { re: /cuanto (?:cuesta|sale) (?:el )?delivery/, weight: 75 },
    { re: /hacen envios?/, weight: 70 },
    { re: /envian a/, weight: 65 },
    { re: /mandan a domicilio/, weight: 70 },
    { re: /a domicilio/, weight: 55 },
    { re: /\benvio\b/, weight: 50 },
    { re: /\bdelivery\b/, weight: 50 },
    { re: /hasta donde (?:envian|llegan|mandan)/, weight: 70 },
    { re: /cobertura/, weight: 45 },
  ],
};

function scoreSystemPatterns(intent: string, text: string) {
  if (!isFaqAutoReplyIntent(intent)) return 0;
  let score = 0;
  for (const pattern of SYSTEM_PATTERNS[intent]) {
    if (pattern.re.test(text)) score += pattern.weight;
  }
  return clampScore(score);
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
    status?: string;
    createdAt: string;
  },
>(messages: T[]) {
  const sorted = [...messages].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const tail: T[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const message = sorted[index];
    const answered =
      (message.direction === "outbound" || message.direction === "bot") &&
      message.status !== "failed";
    if (answered) break;
    if (message.direction === "inbound" && message.body?.trim()) {
      tail.unshift(message);
    }
    if (tail.length >= FAQ_AUTO_REPLY_WINDOW) break;
  }
  return tail;
}

export function wasFaqAutoReplySentToday(
  logs: Array<{
    conversationId: string;
    reason: string;
    createdAt: string;
  }>,
  conversationId: string,
  timeZone = "America/Mexico_City",
) {
  const today = todayDateKey(new Date(), timeZone);
  return logs.some(
    (log) =>
      log.conversationId === conversationId &&
      log.reason.startsWith("faq_auto_reply:") &&
      todayDateKey(new Date(log.createdAt), timeZone) === today,
  );
}

export function findMatchingFaqAutoReply<
  T extends {
    workspaceId: string;
    intent?: string;
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
    const score = Math.max(
      scoreReplyAcceptance(incomingText, reply.phrases),
      scoreSystemPatterns(reply.intent ?? "", text),
    );
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
