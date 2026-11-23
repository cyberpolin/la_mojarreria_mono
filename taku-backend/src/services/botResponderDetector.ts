import type { Message } from "../types.js";

const automatedPatterns = [
  /\b(bot|chatbot)\b/i,
  /\basistente virtual\b/i,
  /\bmensaje autom[aá]tico\b/i,
  /\brespuesta autom[aá]tica\b/i,
  /\bsistema automatizado\b/i,
  /\bsoy un sistema\b/i,
  /\bno soy humano\b/i,
  /\bselecciona una opci[oó]n\b/i,
  /\belige una opci[oó]n\b/i,
  /\bmen[uú]\b/i,
  /\bopci[oó]n\s+\d+\b/i,
  /\bfuera de horario\b/i,
  /\bhorario de atenci[oó]n\b/i,
  /\bte atenderemos\b/i,
  /\ben breve\b/i,
  /\bgracias por comunicarte\b/i,
  /\bno puedo procesar\b/i,
];

const botConfirmationPatterns = [
  /\bs[ií]\b.*\b(bot|chatbot|automatizad[oa]|sistema)\b/i,
  /\bsoy\b.*\b(bot|chatbot|automatizad[oa]|sistema)\b/i,
  /\bes un\b.*\b(bot|chatbot|sistema)\b/i,
  /\b(bot|chatbot|automatizad[oa]|sistema autom[aá]tico)\b/i,
];

const humanDenialPatterns = [
  /\bno\b.*\b(bot|chatbot|automatizad[oa])\b/i,
  /\bsoy\b.*\b(humano|persona|asesor|agente)\b/i,
  /\bhablas con\b.*\b(humano|persona|asesor|agente)\b/i,
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function similarity(left: string, right: string) {
  const leftWords = new Set(left.toLowerCase().split(/\W+/).filter(Boolean));
  const rightWords = new Set(right.toLowerCase().split(/\W+/).filter(Boolean));
  if (!leftWords.size || !rightWords.size) return 0;
  let shared = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) shared += 1;
  }
  return shared / Math.max(leftWords.size, rightWords.size);
}

export function analyzeBotResponderProbability({
  messages,
  conversationId,
  inboundMessageId,
  text,
}: {
  messages: Message[];
  conversationId: string;
  inboundMessageId: string;
  text: string;
}) {
  const normalizedText = normalizeText(text);
  const conversationMessages = messages
    .filter((message) => message.conversationId === conversationId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const current = conversationMessages.find(
    (message) => message.id === inboundMessageId,
  );
  const currentIndex = current ? conversationMessages.indexOf(current) : -1;
  const previousMessages =
    currentIndex >= 0
      ? conversationMessages.slice(0, currentIndex)
      : conversationMessages;
  const previousInbound = [...previousMessages]
    .reverse()
    .find((message) => message.direction === "inbound" && message.body);
  const previousAutomation = [...previousMessages]
    .reverse()
    .find(
      (message) =>
        (message.direction === "bot" || message.direction === "outbound") &&
        message.body,
    );

  let score = 0;
  const reasons: string[] = [];
  const patternHits = automatedPatterns.filter((pattern) =>
    pattern.test(normalizedText),
  ).length;
  if (patternHits) {
    score += Math.min(50, patternHits * 15);
    reasons.push(`automated_text:${patternHits}`);
  }

  if (previousAutomation && current) {
    const responseMs =
      new Date(current.createdAt).getTime() -
      new Date(previousAutomation.createdAt).getTime();
    if (Number.isFinite(responseMs) && responseMs >= 0 && responseMs <= 5_000) {
      score += 25;
      reasons.push("fast_reply_after_taku_message");
    } else if (
      Number.isFinite(responseMs) &&
      responseMs > 5_000 &&
      responseMs <= 15_000
    ) {
      score += 12;
      reasons.push("quick_reply_after_taku_message");
    }
  }

  if (previousInbound?.body) {
    const repeatedSimilarity = similarity(normalizedText, previousInbound.body);
    if (repeatedSimilarity >= 0.85) {
      score += 20;
      reasons.push("repeated_inbound_text");
    }
  }

  if (normalizedText.length > 220 && patternHits > 0) {
    score += 10;
    reasons.push("long_automated_text");
  }

  return {
    scorePercent: clampScore(score),
    reasons,
  };
}

export function isBotResponderConfirmation(text: string) {
  const normalizedText = normalizeText(text);
  if (humanDenialPatterns.some((pattern) => pattern.test(normalizedText))) {
    return false;
  }
  if (/^(s[ií]|si|yes|correcto|afirmativo)[.! ]*$/i.test(normalizedText)) {
    return true;
  }
  return botConfirmationPatterns.some((pattern) =>
    pattern.test(normalizedText),
  );
}

export function isBotResponderDenial(text: string) {
  const normalizedText = normalizeText(text);
  return humanDenialPatterns.some((pattern) => pattern.test(normalizedText));
}
