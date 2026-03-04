// lib/waClient.ts
import { WhatsAppClient } from "./WhatsAppClient";

export const waClient = new WhatsAppClient();

// Inicializa una vez en el arranque
(async (ctx) => {
  // TODO: reactivate
  // await waClient.init(ctx!);
  return () => {};
})();
