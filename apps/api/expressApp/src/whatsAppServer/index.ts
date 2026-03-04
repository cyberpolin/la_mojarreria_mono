// src/whatsapp.ts
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from "fs";
import path from "path";
import { rm } from "fs/promises";
import { handleIncomingMessage } from "./controllers/onMessage";
import { Context } from ".keystone/types";
import qrcode from "qrcode";
import { WhatsApp } from "../lib/whatsapp-socket";
import { DailyClosePayload } from "../types/DailyClosePayload";
import { logSyncResult } from "../../../lib/logSyncResult";
import { processDailyCloseRaw } from "../utils/dailyClose/processDailyCloseRaw";

// DailyClose
type UpsertDailyCloseArgs = {
  context: Context; // si tienes tipo de context, úsalo
  deviceId: string;
  payload: DailyClosePayload;
};
export const upsertDailyCloseRaw = async ({
  payload,
  deviceId,
  context,
}: UpsertDailyCloseArgs) => {
  const nowIso = new Date().toISOString();

  let record;
  try {
    // 🔑 Esto depende del UNIQUE: @@unique([deviceId, date])
    record = await context.prisma.dailyCloseRaw.upsert({
      where: {
        deviceId_date: {
          deviceId,
          date: payload.date,
        },
      },
      create: {
        deviceId,
        date: payload.date,
        payload, // JSON crudo tal cual
        status: "RECEIVED",
        receivedAt: new Date(nowIso),
      },
      update: {
        // Si lo mandan de nuevo, reemplazamos el payload y refrescamos receivedAt
        payload,
        status: "RECEIVED",
        receivedAt: new Date(nowIso),
        errorMessage: null,
        processedAt: null,
      },
    });
  } catch (error) {
    if (record?.id) {
      await context.prisma.dailyCloseRaw.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          processedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
    await logSyncResult({
      context,
      type: "SYNC_DAILY_CLOSE",
      status: "FAILED",
      deviceId,
      date: payload.date,
      errorMessage: error instanceof Error ? error.message : String(error),
      payload,
      useRetryCounter: false,
    });
    throw error;
  }

  await processDailyCloseRaw({
    context,
    deviceId,
    payload,
    rawId: record.id,
  });

  await logSyncResult({
    context,
    type: "SYNC_DAILY_CLOSE",
    status: "SUCCESS",
    deviceId,
    date: payload.date,
    rawId: record.id,
    payload,
    logSuccess: false,
    useRetryCounter: false,
  });

  return {
    ok: true as const,
    syncedAt: nowIso,
    id: record.id,
    date: record.date,
  };
};
// DailyClose

let sock: WASocket | null = null;
let qrCodeData: string | null = null;

export const getQRCode = () => {
  return qrCodeData;
};

// Borra la carpeta ./auth_info antes de iniciar la conexión
export const clearAuthInfo = async () => {
  const authPath = path.join(__dirname, "../", "auth_info");
  console.log(authPath);
  if (fs.existsSync(authPath)) {
    console.log("🧹 Borrando auth_info para reiniciar sesión...");
    await rm(authPath, { recursive: true, force: true });
  }
};

export const startWhatsApp = async () => {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // ya no lo mostraremos en terminal
  });

  WhatsApp.set(sock);

  sock.ev.on("connection.update", ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      qrCodeData = qr;
      console.log("📸 QR actualizado");
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("🔌 Desconectado. ¿Reconectar?", shouldReconnect);
      if (shouldReconnect) startWhatsApp();
    }

    if (connection === "open") {
      qrCodeData = null; // Limpia el QR, ya estamos conectados
      console.log("✅ Conectado a WhatsApp");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    console.log("📥 Mensaje recibido:", messages);
    const msg = messages[0];
    if (msg?.key?.remoteJid === "status@broadcast") return; // Ignora mensajes de difusión
    if (msg?.groupId) return; // Ignora mensajes de grupo
    if (msg?.message) {
      console.log("Mensaje entrante:", msg.message);
      await handleIncomingMessage(msg, ctx, sock);
    }
  });

  sock.ev.on("creds.update", saveCreds);
};

export const resetConection = async (
  req: Request,
  res: Response,
  ctx: Context,
) => {
  clearAuthInfo();
  return res.send(`
    <html>
    <body>
    <h2>Borrando la sesion, por favor vaya aqui.. <a href='/rest/qr'>regresar</a></h2>
    </body>
    </html>
    `);
};

export const connect = async (req: Request, res: Response, ctx: Context) => {
  console.log("Conectando a WhatsApp...");
  const qr = getQRCode();

  const qrImage = await qrcode.toDataURL(qr || "holo");

  // Si no hay QR ni conexión, inicia WhatsApp y espera un poco
  if (!sock || qr === null) {
    console.log("Iniciando WhatsApp...");
    await startWhatsApp(ctx);

    return res.send(`
      <html>
        <body>
          <h2>Iniciando WhatsApp... espera unos segundos y vuelve a cargar esta página.</h2>
          <h2>O borra la sesion <a href='/rest/reset'>aqui</a>.</h2>
<img src="${qrImage}" />
        <p><small>${qr}</small></p>
        
        
        </body>
        </html>
        `);
  }

  // QR listo para mostrar
  res.send(`
        <html>
        <body>
        <h2>Escanea este QR desde WhatsApp</h2>
        <img src="${qrImage}" />
                <p><small>${qr}</small></p>

      </body>
    </html>
  `);
};
