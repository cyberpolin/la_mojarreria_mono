import {
  getCachedFaqAutoReplyPhrases,
  getCachedFaqAutoReplyThreshold,
} from "./autoReplies";
import type { InboxMessage } from "./types";

export const FAQ_SEMAFORO_THRESHOLD = 80;
export const FAQ_SEMAFORO_WINDOW = 3;

export type FaqIntent = "horarios" | "ubicacion" | "envio";

export type FaqScores = {
  horarios: number;
  ubicacion: number;
  envio: number;
  combined: number;
};

export type FaqSemaforoSignal = FaqScores & {
  lastMessageId: string;
  match: boolean;
};

type Pattern = {
  re: RegExp;
  weight: number;
};

const HORARIOS: Pattern[] = [
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
];

const UBICACION: Pattern[] = [
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
];

const ENVIO: Pattern[] = [
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
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeFaqText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phrasePatterns(phrases: string[]): Pattern[] {
  return phrases.flatMap((phrase) => {
    const normalized = normalizeFaqText(phrase);
    if (normalized.length < 3) return [];
    return [{ re: new RegExp(escapeRegExp(normalized)), weight: 80 }];
  });
}

function scorePatterns(text: string, patterns: Pattern[]) {
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.re.test(text)) score += pattern.weight;
  }
  return clampScore(score);
}

function noisyOr(scores: number[]) {
  const miss = scores.reduce(
    (product, score) => product * (1 - score / 100),
    1,
  );
  return clampScore((1 - miss) * 100);
}

export function scoreFaqIntents(text: string): FaqScores {
  const normalized = normalizeFaqText(text);
  if (!normalized) {
    return { horarios: 0, ubicacion: 0, envio: 0, combined: 0 };
  }
  const horarios = scorePatterns(normalized, [
    ...HORARIOS,
    ...phrasePatterns(getCachedFaqAutoReplyPhrases("horarios")),
  ]);
  const ubicacion = scorePatterns(normalized, [
    ...UBICACION,
    ...phrasePatterns(getCachedFaqAutoReplyPhrases("ubicacion")),
  ]);
  const envio = scorePatterns(normalized, [
    ...ENVIO,
    ...phrasePatterns(getCachedFaqAutoReplyPhrases("envio")),
  ]);
  const combined = Math.max(
    horarios,
    ubicacion,
    envio,
    noisyOr([horarios, ubicacion, envio]),
  );
  return { horarios, ubicacion, envio, combined };
}

function inboundText(message: InboxMessage) {
  return message.body?.trim() ?? "";
}

function senderKey(message: InboxMessage) {
  const phone = (message.senderPhone ?? "").replace(/\D/g, "").slice(-10);
  return phone || message.senderName?.trim().toLowerCase() || "";
}

export function lastInboundFaqSignal(
  messages: InboxMessage[],
): FaqSemaforoSignal | null {
  const inbound = [...messages]
    .filter(
      (message) =>
        message.direction === "inbound" && inboundText(message).length > 0,
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const last = inbound[inbound.length - 1];
  if (!last) return null;

  const key = senderKey(last);
  const fromUser = key
    ? inbound.filter((message) => senderKey(message) === key)
    : inbound;
  const window = fromUser.slice(-FAQ_SEMAFORO_WINDOW);
  const scores = scoreFaqIntents(window.map(inboundText).join(" "));
  return {
    lastMessageId: last.id,
    ...scores,
    match:
      scores.horarios >= getCachedFaqAutoReplyThreshold("horarios") ||
      scores.ubicacion >= getCachedFaqAutoReplyThreshold("ubicacion") ||
      scores.envio >= getCachedFaqAutoReplyThreshold("envio") ||
      scores.combined >= FAQ_SEMAFORO_THRESHOLD,
  };
}

export function shouldShowFaqSemaforo(
  messages: InboxMessage[],
  messageId: string,
) {
  const signal = lastInboundFaqSignal(messages);
  return Boolean(signal?.match && signal.lastMessageId === messageId);
}
