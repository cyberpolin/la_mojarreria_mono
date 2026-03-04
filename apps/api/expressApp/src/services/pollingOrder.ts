// src/services/pollingManager.ts

type Listener = (messages: any[]) => void;

// Plano: no anidado, fácil de limpiar
const listeners: Record<string, Listener> = {};
const messageQueue: Record<string, any[]> = {};

/**
 * Registra una nueva conexión de polling para una ventana (listener).
 */
export function registerPolling(
  listenerId: string,
  res: any,
  timeoutMs = 30000,
) {
  const key = `${listenerId}`;

  console.log(`🛎️  Nuevo polling registrado ListenerID: ${listenerId}---`);
  console.log(`---  Total amount of polling ---`);
  console.log(
    `---  Total amount of listeners ${JSON.stringify(listeners)} ---`,
  );
  console.log(
    `---  Total amount of messageQueue ${JSON.stringify(messageQueue)} ---`,
  );

  if (messageQueue[key]?.length) {
    const pending = messageQueue[key];
    delete messageQueue[key];
    res.json({ newMessages: pending });
    return;
  }

  let responded = false;

  const timeout = setTimeout(() => {
    if (!responded) {
      res.json({ newMessages: [] });
      responded = true;
    }
  }, timeoutMs);

  listeners[key] = (messages: any[]) => {
    if (!responded) {
      clearTimeout(timeout);
      res.json({ newMessages: messages });
      responded = true;
    }
  };
}

/**
 * Envía mensajes nuevos a todos los listeners activos de un chat.
 */
export function dispatchMessages(chatId: string, messages: any[]) {
  for (const key in listeners) {
    if (key.startsWith(`${chatId}-`)) {
      listeners[key](messages);
      delete listeners[key];
    }
  }
}

/**
 * Opcional: limpia messageQueue y listeners antiguos o inactivos
 */
export function garbageCollectInactive(chatId: string) {
  for (const key in messageQueue) {
    if (key.startsWith(`${chatId}-`)) {
      delete messageQueue[key];
    }
  }
  for (const key in listeners) {
    if (key.startsWith(`${chatId}-`)) {
      delete listeners[key];
    }
  }
}
