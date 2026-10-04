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

export function findMatchingFaqAutoReply<
  T extends {
    workspaceId: string;
    intent: FaqAutoReplyIntent;
    phrases: string[];
    responseText: string;
    enabled: boolean;
  },
>(replies: T[], workspaceId: string, incomingText: string) {
  const text = normalizeFaqPhrase(incomingText);
  if (!text) return null;
  for (const intent of FAQ_AUTO_REPLY_INTENTS) {
    const reply = replies.find(
      (item) => item.workspaceId === workspaceId && item.intent === intent,
    );
    if (!reply?.enabled || !reply.responseText.trim()) continue;
    const matched = reply.phrases.some((phrase) => {
      const needle = normalizeFaqPhrase(phrase);
      return needle.length >= 3 && text.includes(needle);
    });
    if (matched) return reply;
  }
  return null;
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
