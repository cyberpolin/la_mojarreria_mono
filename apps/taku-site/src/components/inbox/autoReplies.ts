import { takuApi } from "@/lib/taku-api";

export type FaqAutoReplyIntent = "horarios" | "ubicacion" | "envio";

export type FaqAutoReply = {
  id: string;
  workspaceId: string;
  intent: string;
  title: string;
  phrases: string[];
  responseText: string;
  enabled: boolean;
  threshold: number;
  createdAt: string;
  updatedAt: string;
};

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

const STORAGE_KEY = "MOJARRERIA_TAKU_FAQ_AUTO_REPLIES";
const STORAGE_VERSION = 2;

type StoredFaqAutoReplies = {
  version: number;
  items: FaqAutoReply[];
};

let cache: FaqAutoReply[] | null = null;

function nowIso() {
  return new Date().toISOString();
}

export function isSystemFaqAutoReply(
  intent: string,
): intent is FaqAutoReplyIntent {
  return FAQ_AUTO_REPLY_INTENTS.includes(intent as FaqAutoReplyIntent);
}

export function parseThreshold(value: unknown, fallback = 80) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(100, Math.round(parsed)));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeFaqPhrase(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

export function defaultFaqAutoReplies(workspaceId = ""): FaqAutoReply[] {
  const stamp = nowIso();
  return FAQ_AUTO_REPLY_INTENTS.map((intent) => {
    const defaults = FAQ_AUTO_REPLY_DEFAULTS[intent];
    return {
      id: `local-${intent}`,
      workspaceId,
      intent,
      title: defaults.title,
      phrases: [...defaults.phrases],
      responseText: defaults.responseText,
      enabled: true,
      threshold: 80,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
}

function normalizeReply(value: unknown): FaqAutoReply | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<FaqAutoReply>;
  if (typeof item.id !== "string" || typeof item.intent !== "string")
    return null;
  if (!Array.isArray(item.phrases)) return null;
  return {
    id: item.id,
    workspaceId: typeof item.workspaceId === "string" ? item.workspaceId : "",
    intent: item.intent,
    title:
      typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : "Nueva respuesta",
    phrases: item.phrases.filter(
      (phrase): phrase is string => typeof phrase === "string",
    ),
    responseText:
      typeof item.responseText === "string" ? item.responseText : "",
    enabled: item.enabled !== false,
    threshold: parseThreshold(item.threshold),
    createdAt: typeof item.createdAt === "string" ? item.createdAt : nowIso(),
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : nowIso(),
  };
}

export function readCachedFaqAutoReplies(): FaqAutoReply[] {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = defaultFaqAutoReplies();
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = defaultFaqAutoReplies();
      return cache;
    }
    const parsed = JSON.parse(raw) as StoredFaqAutoReplies;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.items)) {
      cache = defaultFaqAutoReplies();
      return cache;
    }
    const items = parsed.items
      .map(normalizeReply)
      .filter((item): item is FaqAutoReply => item !== null);
    cache = items.length > 0 ? items : defaultFaqAutoReplies();
    return cache;
  } catch {
    cache = defaultFaqAutoReplies();
    return cache;
  }
}

export function writeCachedFaqAutoReplies(items: FaqAutoReply[]) {
  cache = items;
  if (typeof window === "undefined") return;
  const payload: StoredFaqAutoReplies = {
    version: STORAGE_VERSION,
    items,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getCachedFaqAutoReply(intent: string) {
  return (
    readCachedFaqAutoReplies().find((row) => row.intent === intent) ?? null
  );
}

export function getCachedFaqAutoReplyPhrases(intent: FaqAutoReplyIntent) {
  const item = getCachedFaqAutoReply(intent);
  if (!item?.enabled) return [];
  return item.phrases;
}

export function getCachedFaqAutoReplyThreshold(intent: FaqAutoReplyIntent) {
  return getCachedFaqAutoReply(intent)?.threshold ?? 80;
}

export function upsertCachedFaqAutoReply(item: FaqAutoReply) {
  const current = readCachedFaqAutoReplies();
  const index = current.findIndex(
    (row) => row.id === item.id || row.intent === item.intent,
  );
  const next =
    index >= 0
      ? current.map((row, rowIndex) => (rowIndex === index ? item : row))
      : [...current, item];
  writeCachedFaqAutoReplies(next);
  return next;
}

export function removeCachedFaqAutoReply(id: string) {
  const next = readCachedFaqAutoReplies().filter((row) => row.id !== id);
  writeCachedFaqAutoReplies(next);
  return next;
}

export function createLocalFaqAutoReply(): FaqAutoReply {
  const stamp = nowIso();
  const token = `${Date.now().toString(36)}`;
  return {
    id: `local-${token}`,
    workspaceId: "",
    intent: `custom-${token}`,
    title: "Nueva respuesta",
    phrases: [],
    responseText: "",
    enabled: true,
    threshold: 80,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

let faqPersistPromise: Promise<void> | null = null;

export async function persistLocalFaqAutoReplies() {
  if (faqPersistPromise) return faqPersistPromise;
  faqPersistPromise = (async () => {
    const items = readCachedFaqAutoReplies().filter(
      (item) => item.enabled && item.responseText.trim().length > 0,
    );
    for (const item of items) {
      try {
        await saveFaqAutoReply(item);
      } catch {
        // Keep listing even if one reply cannot sync.
      }
    }
  })();
  return faqPersistPromise;
}

export async function fetchFaqAutoReplies() {
  const items = await takuApi<FaqAutoReply[]>("/faq-auto-replies");
  writeCachedFaqAutoReplies(
    items.map((item) => normalizeReply(item)!).filter(Boolean),
  );
  return readCachedFaqAutoReplies();
}

type FaqAutoReplyPayload = {
  title: string;
  phrases: string[];
  responseText: string;
  enabled: boolean;
  threshold: number;
};

export async function saveFaqAutoReply(item: FaqAutoReply) {
  const payload: FaqAutoReplyPayload = {
    title: item.title,
    phrases: item.phrases,
    responseText: item.responseText,
    enabled: item.enabled,
    threshold: parseThreshold(item.threshold),
  };
  const saved =
    item.id.startsWith("local-") && !isSystemFaqAutoReply(item.intent)
      ? await takuApi<FaqAutoReply>("/faq-auto-replies", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      : await takuApi<FaqAutoReply>(
          `/faq-auto-replies/${isSystemFaqAutoReply(item.intent) ? item.intent : item.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
        );
  const normalized = normalizeReply(saved) ?? saved;
  if (item.id.startsWith("local-") && normalized.id !== item.id) {
    const withoutLocal = readCachedFaqAutoReplies().filter(
      (row) => row.id !== item.id,
    );
    writeCachedFaqAutoReplies(withoutLocal);
  }
  upsertCachedFaqAutoReply(normalized);
  return normalized;
}

export async function deleteFaqAutoReply(item: FaqAutoReply) {
  if (!item.id.startsWith("local-")) {
    await takuApi<{ deleted: boolean }>(`/faq-auto-replies/${item.id}`, {
      method: "DELETE",
    });
  }
  return removeCachedFaqAutoReply(item.id);
}
