import { universalHandleIncomingMessage } from "../../controllers/whatsappController";

// controllers/onMessage.ts
export async function handleIncomingMessage(msg, ctx, sock) {
  universalHandleIncomingMessage(msg, ctx);

  // lógica aquí
}
