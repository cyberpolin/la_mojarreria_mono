import { takuApi } from "@/lib/taku-api";

export type FaqAutoReplyIntent = "horarios" | "ubicacion" | "envio";

export type FaqAutoReply = {
  id: string;
  workspaceId: string;
  intent: FaqAutoReplyIntent;
  title: string;
  phrases: string[];
  responseText: string;
  enabled: boolean;
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
const STORAGE_VERSION = 1;

type StoredFaqAutoReplies = {
  version: number;
  items: FaqAutoReply[];
};

let cache: FaqAutoReply[] | null = null;

function nowIso() {
  return new Date().toISOString();
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
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
}

function isFaqAutoReply(value: unknown): value is FaqAutoReply {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<FaqAutoReply>;
  return (
    typeof item.id === "string" &&
    typeof item.intent === "string" &&
    FAQ_AUTO_REPLY_INTENTS.includes(item.intent as FaqAutoReplyIntent) &&
    Array.isArray(item.phrases)
  );
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
    if (
      parsed.version !== STORAGE_VERSION ||
      !Array.isArray(parsed.items) ||
      !parsed.items.every(isFaqAutoReply)
    ) {
      cache = defaultFaqAutoReplies();
      return cache;
    }
    cache = parsed.items;
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

export function getCachedFaqAutoReplyPhrases(intent: FaqAutoReplyIntent) {
  const item = readCachedFaqAutoReplies().find((row) => row.intent === intent);
  if (!item?.enabled) return [];
  return item.phrases;
}

export function upsertCachedFaqAutoReply(item: FaqAutoReply) {
  const current = readCachedFaqAutoReplies();
  const next = FAQ_AUTO_REPLY_INTENTS.map((intent) => {
    if (intent === item.intent) return item;
    return (
      current.find((row) => row.intent === intent) ??
      defaultFaqAutoReplies().find((row) => row.intent === intent)!
    );
  });
  writeCachedFaqAutoReplies(next);
  return next;
}

export async function fetchFaqAutoReplies() {
  const items = await takuApi<FaqAutoReply[]>("/faq-auto-replies");
  writeCachedFaqAutoReplies(items);
  return items;
}

export async function saveFaqAutoReply(
  intent: FaqAutoReplyIntent,
  payload: {
    phrases: string[];
    responseText: string;
    enabled: boolean;
  },
) {
  const item = await takuApi<FaqAutoReply>(`/faq-auto-replies/${intent}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  upsertCachedFaqAutoReply(item);
  return item;
}
