// lib/withCustomContext.ts
import { Context } from ".keystone/types"; // importa el tipo correcto si usas otro lugar
import { WhatsAppClient } from "./WhatsAppClient";

export function withCustomContext(context: Context) {
  return {
    ...context,
    whatsapp: WhatsAppClient,
  };
}
