export interface ParsedMessage {
  type: string;
  text?: string;
  mediaUrl?: string;
  fromMe: boolean;
  from: string;
  raw: any;
}

export function parseIncomingMessage(message: any): ParsedMessage {
  console.log("Parsing incoming message:", JSON.stringify(message, null, 2));

  const msg = message?.message;
  if (!msg) {
    return {
      type: "unknown",
      raw: message,
      fromMe: false,
      from: "unknown",
    };
  }

  const type = Object.keys(msg)[0];

  switch (type) {
    case "conversation":
      return {
        type: "text",
        text: msg.conversation,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    case "extendedTextMessage":
      return {
        type: /https?:\/\//.test(msg.extendedTextMessage.text)
          ? "link"
          : "extended_text",
        text: msg.extendedTextMessage.text,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    case "imageMessage":
      return {
        type: "image",
        text: msg.imageMessage.caption || undefined,
        mediaUrl: msg.imageMessage.url,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    case "videoMessage":
      return {
        type: "video",
        text: msg.videoMessage.caption || undefined,
        mediaUrl: msg.videoMessage.url,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    case "audioMessage":
      return {
        type: msg.audioMessage.ptt ? "voice_note" : "audio",
        mediaUrl: msg.audioMessage.url,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    case "documentMessage":
      return {
        type: "document",
        text: msg.documentMessage.fileName,
        mediaUrl: msg.documentMessage.url,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    case "stickerMessage":
      return {
        type: "sticker",
        mediaUrl: msg.stickerMessage.url,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    case "locationMessage":
      return {
        type: "location",
        text: `Ubicación: ${msg.locationMessage.degreesLatitude}, ${msg.locationMessage.degreesLongitude}`,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    case "contactMessage":
      return {
        type: "contact",
        text: msg.contactMessage.displayName,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    case "reactionMessage":
      return {
        type: "reaction",
        text: msg.reactionMessage.text,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    case "buttonsResponseMessage":
    case "templateButtonReplyMessage":
      return {
        type: "button_reply",
        text: msg[type].selectedButtonId || msg[type].text,
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };

    default:
      return {
        type: type || "unknown",
        raw: message,
        fromMe: message.key.fromMe,
        from: message.key.remoteJid,
      };
  }
}
