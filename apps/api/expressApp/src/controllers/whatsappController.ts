import { Context } from ".keystone/types";

import { Request, Response } from "express";
import { getOrcreateChatByPhone } from "./chatController";
import { createMessageMethod } from "./messageController";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { WhatsApp } from "../lib/whatsapp-socket";

const WA_TOKEN = process.env.WA_TOKEN;
const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN;
const WA_ID = process.env.WA_ID;

export async function verifyToken(req: Request, res: Response, ctx: Context) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  console.log("Verifying token:", { mode, token, challenge, VERIFY_TOKEN });

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
}

export const sendWhatsAppMessage = async (to: string, message: string) => {
  console.log("Enviando mensaje a WhatsApp:", { to, message });

  // Using baleys WhatsApp API
  try {
    await WhatsApp.sendMessage({
      jid: `${to}@s.whatsapp.net`, // Convertir el número al formato internacional
      text: message,
    });
    // Using baleys WhatsApp API

    //WA API, not working due WA
    // // try {
    // //   const url = `https://graph.facebook.com/v18.0/${WA_ID}/messages`;

    // //   const payload = {
    // //     messaging_product: 'whatsapp',
    // //     to: to.replace('521', '52'),
    // //     type: 'text',
    // //     text: { body: message },
    // //   };

    // //   const headers = {
    // //     Authorization: `Bearer ${WA_TOKEN}`,
    // //     'Content-Type': 'application/json',
    // //   };

    // //   const { data } = await axios.post(url, payload, { headers });
    //   console.log('Mensaje enviado a WA:', data);
    return;
  } catch (error) {
    console.error(
      "Error enviando mensaje a WhatsApp 1 :",
      error.response?.data || error.message,
    );
  }
};

export const sendBaleysWhatsAppMessage = async (to, message) => {
  console.log("Enviando mensaje a WhatsApp:", { to, message });
  try {
    const url = `https://graph.facebook.com/v18.0/${WA_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to: to.replace("521", "52"),
      type: "text",
      text: { body: message },
    };

    const headers = {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    };

    const { data } = await axios.post(url, payload, { headers });
    console.log("Mensaje enviado a WA:", data);
    return data;
  } catch (error) {
    console.error(
      "Error enviando mensaje a WhatsApp 2:",
      error.response?.data || error.message,
    );
  }
};

export async function handleIncomingMessage(
  req: Request,
  res: Response,
  ctx: Context,
) {
  const { object, entry } = req.body;

  const { contacts, messages } = entry[0].changes[0].value;

  const { profile, wa_id } = contacts?.[0] || {};

  const { from, timestamp, text } = messages?.[0] || {};

  if (!text) {
    return res.sendStatus(200); // No hay texto, no hacemos nada
  }

  console.log("Mensajes entrantes:", {
    from,
    timestamp,
    text,
    profile,
    wa_id,
    contacts,
    messages,
  });

  // Lets get the chat id or create a new chat session
  const { chatSessionId, userId, firstTime } = await getOrcreateChatByPhone(
    from.replace("521", "52"),
    ctx,
  );

  if (firstTime) {
    return; // do nothing, welcome message has already been sent
  }

  const internalId = uuidv4();
  const sender = "USER";

  await createMessageMethod(
    { chatId: chatSessionId, userId, content: text.body, internalId, sender },
    res ?? null,
    ctx,
  );

  // console.log('Incoming WA message:', JSON.stringify({
  //   from, timestamp, name: profile.name, text: text.body
  // }, null, 2));
  // res.sendStatus(200);
}

{
  // [1]   key: {
  // [1]     remoteJid: '5219937040071@s.whatsapp.net',
  // [1]     fromMe: false,
  // [1]     id: '7CDD87EC82F4580772',
  // [1]     participant: undefined
  // [1]   },
  // [1]   messageTimestamp: 1748193403,
  // [1]   pushName: '5219937040071',
  // [1]   broadcast: false,
  // [1]   message: Message {
  // [1]     conversation: 'yo',
  // [1]     messageContextInfo: MessageContextInfo {
  // [1]       deviceListMetadata: [DeviceListMetadata],
  // [1]       deviceListMetadataVersion: 2
  // [1]     }
  // [1]   },
  // [1]   verifiedBizName: 'La Mojarreria'
  // [1] }
}
export const universalHandleIncomingMessage = async (message, ctx) => {
  const { conversation: text } = message.message;
  const name = message.pushName;
  const from = message.key.remoteJid
    .replace("@s.whatsapp.net", "")
    .replace("@g.us", ""); // Remove WhatsApp suffix
  console.log("Mensaje entrante:", { from, text });

  const { chatSessionId, userId, firstTime } = await getOrcreateChatByPhone(
    from.replace("521", "52"),
    ctx,
  );
  if (firstTime) {
    return; // do nothing, welcome message has already been sent
  }
  const internalId = uuidv4();
  const sender = "USER";
  await createMessageMethod(
    { chatId: chatSessionId, userId, content: text, internalId, sender },
    null,
    ctx,
  );
};
