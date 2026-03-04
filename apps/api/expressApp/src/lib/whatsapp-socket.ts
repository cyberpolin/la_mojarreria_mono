import type { WASocket } from "@whiskeysockets/baileys";

export const WhatsApp = {
  sock: null as WASocket | null,

  set(sock: WASocket) {
    this.sock = sock;
  },

  get(): WASocket {
    if (!this.sock) throw new Error("❌ WhatsApp aún no está conectado");
    return this.sock;
  },

  isReady(): boolean {
    return !!this.sock;
  },

  async sendMessage(data: { jid: string; text: string }) {
    console.log("Enviando mensaje a sendMessage:", data);
    const { jid, text } = data;
    if (!jid || !text) {
      throw new Error(
        "❌ Debes proporcionar un jid y un texto para enviar el mensaje",
      );
    }

    return this.sock?.sendMessage(jid, { text });
  },

  async sendImage(jid: string, url: string, caption?: string) {
    const sock = this.get();
    return sock.sendMessage(jid, {
      image: { url },
      caption: caption ?? "",
    });
  },

  async sendButtons(
    jid: string,
    text: string,
    buttons: { id: string; title: string }[],
  ) {
    const sock = this.get();
    return sock.sendMessage(jid, {
      text,
      buttons: buttons.map((b) => ({
        buttonId: b.id,
        buttonText: { displayText: b.title },
        type: 1,
      })),
      headerType: 1,
    });
  },

  async reply(jid: string, messageId: string, text: string) {
    const sock = this.get();
    return sock.sendMessage(
      jid,
      {
        text,
      },
      {
        quoted: {
          key: { remoteJid: jid, id: messageId, fromMe: false },
          message: { conversation: "" },
        },
      },
    );
  },
};
