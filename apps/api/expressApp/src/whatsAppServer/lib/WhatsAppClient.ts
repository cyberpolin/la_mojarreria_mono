// lib/WhatsAppClient.ts
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as qrcode from "qrcode-terminal";
import { Context } from ".keystone/types";
import { getOrcreateChatByPhone } from "../../controllers/chatController";
import { createMessageMethod } from "../../controllers/messageController";
import * as Sentry from "@sentry/node";
import { parseIncomingMessage } from "./messages";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../../../keystone";

const showQrCode = (qr: string | undefined) => {
  if (qr) {
    console.log("📱 Escanea este código QR con WhatsApp:");
    qrcode.generate(qr, { small: true }); // imprime el QR en la terminal
  } else {
    console.log("No hay código QR disponible");
  }
};

const authPath = path.resolve(__dirname, "../auth_info");

// // ✅ Borrar sesión si se solicita por env var
// if (process.env.CLEAR_WHATSAPP_SESSION === 'true') {
//   if (fs.existsSync(authPath)) {
//     fs.rmSync(authPath, { recursive: true, force: true });
//     console.log('🧹 Se eliminó la sesión de WhatsApp anterior');
//   }
// }

const shouldSendMessages = async (prisma, message) => {
  const sing = await prisma.sing.findFirst({
    select: {
      id: true,
      phones: true,
      modeDeveloper: true,
    },
  });
  const listNumbers = sing?.phones?.split(",") || [];
  return (
    sing?.modeDeveloper &&
    !listNumbers.includes(message.key.remoteJid.replace("@s.whatsapp.net", ""))
  );
};

export class WhatsAppClient {
  private socket: WASocket | null = null;
  private isReady = false;
  private isConnecting = false;
  private ctx = null as Context | null;
  // temporal max users
  private maxUsers = 50; // máximo de usuarios que pueden conectarse al WhatsApp
  private currentUsers = []; // usuarios conectados actualmente

  async init(ctx: Context) {
    this.ctx = ctx; // guarda el contexto para usarlo en onMessage
    if (this.isConnecting || this.socket || this.isReady) return; // evita doble init
    this.isConnecting = true;
    const buildCommand = process.argv.some((arg) => arg.includes("build"));
    if (buildCommand || true) {
      console.log(
        "🚧 Modo build detectado, no se iniciará la conexión a WhatsApp.",
      );
      this.isConnecting = false;
      return; // Si está en modo build, no inicia la conexión
    }
    console.log("🔗 Conectando a WhatsApp...", buildCommand);

    const { version } = await fetchLatestBaileysVersion();

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    // console.log("📂 Usando auth info en:", process.env.args);
    // console.log("📦 Versión de Baileys:", version.join("."));
    // console.log("🔑 Estado de autenticación cargado:", state);

    this.socket = makeWASocket({
      version,
      auth: state,
    });

    this.socket.ev.on("creds.update", saveCreds);

    this.socket.ev.on(
      "connection.update",
      async ({ connection, lastDisconnect, qr }) => {
        const connecting = connection === "connecting";
        const connected = connection === "open";
        const disconnected = connection === "close";

        showQrCode(qr);
        console.log("🔄 Actualización de conexión:", { connection, qr });

        //If is conecting
        if (connecting) {
          this.isConnecting = true;
          this.isReady = false;
          console.log("🔄 Conectando a WhatsApp...");
        }

        //If is disconnected
        if (disconnected) {
          if (connection === "close") {
            // clear session data if disconnected
            this.socket = null;
            this.isReady = false;
            this.isConnecting = false;
            console.warn("🔌 Desconectado de WhatsApp.");
            const statusCode = (lastDisconnect?.error as Boom)?.output
              ?.statusCode;

            if (lastDisconnect?.error instanceof Boom) {
              const statusCode = lastDisconnect.error.output?.statusCode;

              if (
                statusCode === DisconnectReason.connectionClosed ||
                statusCode === DisconnectReason.timedOut
              ) {
                console.log("🔁 Reintentando conexión por timeout...");
                await this.init(this.ctx!);
              }
            }

            if (statusCode === 515) {
              // 515 just read QR code, need to reinit
              this.socket = null;
              this.isReady = false;
              this.isConnecting = false;

              console.warn("🔁 Esperando 3s antes de reconectar...");

              await new Promise((res) => setTimeout(res, 3000));

              await this.init(this.ctx!);
            }
          }

          if (connected) {
            this.isReady = true;
            this.isConnecting = false;
            console.log("✅ WhatsApp conectado!");
          }
        }
      },
    );

    this.socket.ev.on("messages.upsert", async (m) => {
      try {
        this.onMessage(m.messages[0]);
      } catch (error) {
        await this.logMessageError("messages.upsert", error, m.messages[0]);
        // Log the error to Sentry
        console.error("Error procesando mensaje:", error);
        Sentry.captureException(error, {
          extra: {
            rawMessage: JSON.stringify(m.messages[0]),
            from: "messages.upsert",
          },
        });
      }
    });
  }

  async onMessage(message: any) {
    const isDevValid = await shouldSendMessages(prisma, message);

    if (!this.ctx) {
      console.warn("⚠️ Contexto no disponible en onMessage");
      return;
    }
    try {
      try {
        const parsed = parseIncomingMessage(message);
        // const regex = /^521\d{10}@s\.whatsapp\.net$/;
        const regex = /^5219931175435@s\.whatsapp\.net$/;

        if (parsed.fromMe) {
          console.log("🔒 Mensaje de WhatsApp propio, ignorando...");
          return; // Ignora mensajes propios
        }

        if (isDevValid) {
          console.log(
            "🔒 Modo desarrollador activo, ignorando mensaje de:",
            parsed.from,
          );
          return; // Ignora mensajes si está en modo desarrollador y el número no está en la lista
        }

        if (
          parsed.type === "text" ||
          parsed.type === "extended_text" ||
          parsed.type === "link" ||
          !parsed.fromMe ||
          regex.test(parsed.from)
          // !regex.test(parsed.from)
        ) {
          const chatJId = parsed.from;
          const messageContent = parsed.text || parsed.mediaUrl;

          // Wrap getOrcreateChat too
          let chatSessionId, userId, firstTime;
          try {
            //@ts-ignore
            const result = await getOrcreateChatByPhone(
              chatJId.replace("@s.whatsapp.net", ""),
              this.ctx,
            );

            ({ chatSessionId, userId, firstTime } = result);
          } catch (err) {
            console.error("❌ Error en getOrcreateChatByPhone:", err);
            await this.logMessageError(
              "onMessage:getOrcreateChatByPhone",
              err,
              message,
            );
            return;
          }
          if (firstTime) {
            console.log(
              `👤 Nuevo usuario creado: ${userId} en chat ${chatSessionId}`,
            );
            return;
          }
          console.log(`📩 Mensaje recibido de ${chatJId}: ${messageContent}`);
          const internalId = uuidv4();
          const sender = "USER";

          await createMessageMethod(
            {
              chatId: chatSessionId,
              userId,
              content: messageContent,
              internalId,
              sender,
            },
            null,
            this.ctx,
          );
        }
      } catch (err) {
        await this.logMessageError(
          "onMessage:parseIncomingMessage",
          err,
          message,
        );
        return;
      }
    } catch (err) {
      console.error("❌ Error general en onMessage:", err);
      await this.logMessageError("onMessage:generalError", err, message);
    }
  }

  async logMessageError(from: string, error: any, message: any) {
    Sentry.captureException(error, {
      extra: {
        rawMessage: JSON.stringify(message),
        from,
      },
    });
    const errorMessage = `Error procesando mensaje: ${error.message || error}`;
    console.error(errorMessage);
  }

  async sendText(to: string, message: string) {
    if (!this.socket) throw new Error("Socket no conectado");
    return this.socket.sendMessage(to, { text: message });
  }

  async sendButton(to: string, orderId: string, message: string) {
    if (!this.socket) throw new Error("Socket no conectado");
    return this.socket.sendMessage(to, {
      text: message,
      footer: `la mojarrería`,
      buttonReply: { displayText: "Ver pedido", id: orderId, index: 0 },
    });
  }

  getSocket(): WASocket {
    if (!this.socket) throw new Error("Socket no inicializado aún");
    return this.socket;
  }
}
