import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  useMultiFileAuthState,
  type AnyMessageContent,
  type BaileysEventMap,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import { rm } from "node:fs/promises";
import type { Logger } from "pino";
import qrcode from "qrcode-terminal";
import type { AppConfig } from "../config.js";
import { getCampaignForPhone } from "../services/campaignStore.js";
import { notifySubscriptionReply } from "../services/backendWebhook.js";
import { isAutoresponseTestPhone } from "../services/autoresponseTestPhoneStore.js";
import { createBotReply } from "../services/botServiceClient.js";
import {
  listConversationMessages,
  recordConversationMessage,
} from "../services/conversationStore.js";
import { activateDummyRegistry } from "../services/dummyRegistryApi.js";
import { recordInboundContact } from "../services/inboundContactStore.js";
import { recordDebugLog } from "../services/debugLogStore.js";
import { recordReceivedMessageLog } from "../services/receivedMessageLogStore.js";
import { resetSessionIssue } from "../services/sessionIssueStore.js";
import {
  activateRegistry,
  getRegistryRecord,
} from "../services/registryStore.js";
import { dispatchWebhookEvent } from "../services/webhookDispatcher.js";
import { phoneFromWhatsAppJid, phoneToWhatsAppJid } from "../utils/phone.js";

type MessagesUpsert = BaileysEventMap["messages.upsert"];
type MessagesUpdate = BaileysEventMap["messages.update"];
type MessageReceiptUpdate = BaileysEventMap["message-receipt.update"];
export type WaServiceState =
  | "INACTIVE"
  | "STARTING"
  | "ACTIVE"
  | "STOPPING"
  | "ERROR";

export type WaServiceStatus = {
  active: boolean;
  connected: boolean;
  connection: "connecting" | "open" | "close";
  hasQr: boolean;
  state: WaServiceState;
  lastChangedAt: string;
};

type StatusChangeHandler = (
  status: WaServiceStatus,
  reason: string,
) => void | Promise<void>;

function getDisconnectStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const output = "output" in error ? error.output : undefined;
  if (
    typeof output !== "object" ||
    output === null ||
    !("statusCode" in output)
  ) {
    return undefined;
  }

  return typeof output.statusCode === "number" ? output.statusCode : undefined;
}

function getMessageText(
  message: proto.IMessage | null | undefined,
): string | null {
  if (!message) {
    return null;
  }

  if (message.conversation) {
    return message.conversation.trim();
  }

  if (message.extendedTextMessage?.text) {
    return message.extendedTextMessage.text.trim();
  }

  if (message.imageMessage?.caption) {
    return message.imageMessage.caption.trim();
  }

  if (message.videoMessage?.caption) {
    return message.videoMessage.caption.trim();
  }

  if (message.buttonsResponseMessage?.selectedDisplayText) {
    return message.buttonsResponseMessage.selectedDisplayText.trim();
  }

  if (message.buttonsResponseMessage?.selectedButtonId) {
    return message.buttonsResponseMessage.selectedButtonId.trim();
  }

  if (message.listResponseMessage?.title) {
    return message.listResponseMessage.title.trim();
  }

  return null;
}

function getMessageTimestamp(message: proto.IWebMessageInfo): string {
  const timestamp = message.messageTimestamp;

  if (typeof timestamp === "number") {
    return new Date(timestamp * 1000).toISOString();
  }

  if (typeof timestamp === "bigint") {
    return new Date(Number(timestamp) * 1000).toISOString();
  }

  return new Date().toISOString();
}

export class WhatsAppClient {
  private socket: WASocket | null = null;
  private isStopping = false;
  private desiredActive = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private latestQr: string | null = null;
  private connectionStatus: "connecting" | "open" | "close" = "close";
  private serviceState: WaServiceState = "INACTIVE";
  private lastChangedAt = new Date().toISOString();
  private statusChangeHandler: StatusChangeHandler | null = null;
  private phoneByLid = new Map<string, string>();
  private messageCache = new Map<string, proto.IMessage>();

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  setStatusChangeHandler(handler: StatusChangeHandler): void {
    this.statusChangeHandler = handler;
  }

  async connect(reason = "socket_connect"): Promise<void> {
    if (this.socket && this.connectionStatus !== "close") {
      return;
    }

    this.isStopping = false;
    this.connectionStatus = "connecting";
    this.updateServiceState("STARTING", reason);

    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState(
      this.config.whatsappAuthDir,
    );
    const { version } = await fetchLatestBaileysVersion();
    const baileysLogger = this.logger.child({ module: "baileys" });

    const socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      syncFullHistory: false,
      logger: baileysLogger,
      markOnlineOnConnect: false,
      retryRequestDelayMs: 500,
      maxMsgRetryCount: 5,
      shouldSyncHistoryMessage: () => false,
      getMessage: async (key) =>
        key.id ? this.messageCache.get(key.id) : undefined,
    });

    this.socket = socket;

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (update) => {
      recordDebugLog({
        event: "baileys_connection_update",
        data: {
          connection: update.connection,
          hasQr: Boolean(update.qr),
          receivedPendingNotifications: update.receivedPendingNotifications,
          isNewLogin: update.isNewLogin,
        },
      });

      if (update.qr) {
        this.latestQr = update.qr;
        this.logger.info(
          "Scan this QR code with WhatsApp to connect the service",
        );
        qrcode.generate(update.qr, { small: true });
      }

      if (update.connection === "open") {
        this.latestQr = null;
        this.connectionStatus = "open";
        this.updateServiceState("ACTIVE", "connected");
        this.logger.info("WhatsApp socket connected");
      }

      if (update.connection === "close") {
        this.connectionStatus = "close";
        const statusCode = getDisconnectStatusCode(
          update.lastDisconnect?.error,
        );
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        this.logger.warn(
          { statusCode, loggedOut },
          "WhatsApp socket disconnected",
        );

        if (!this.isStopping && !loggedOut) {
          this.updateServiceState("ERROR", "disconnected");
          this.scheduleReconnect();
        } else if (loggedOut) {
          this.updateServiceState("ERROR", "logged_out");
        } else {
          this.updateServiceState("INACTIVE", "stopped");
        }
      }
    });

    socket.ev.on("messages.upsert", (event) => {
      console.log("----------------------------------");
      console.log("messages.upsert event received:", {
        type: event.type,
        messageCount: event.messages.length,
        messageIds: event.messages
          .map((message) => message.key.id)
          .filter(Boolean),
        remoteJids: event.messages
          .map((message) => message.key.remoteJid)
          .filter(Boolean),
      });
      console.log("----------------------------------");
      void this.handleMessagesUpsert(event);
    });
    socket.ev.on("messages.update", (updates) => {
      this.handleMessagesUpdate(updates);
    });
    socket.ev.on("message-receipt.update", (updates) => {
      this.handleMessageReceiptUpdate(updates);
    });
    socket.ev.on("chats.phoneNumberShare", ({ lid, jid }) => {
      const phone = phoneFromWhatsAppJid(jid);
      if (phone) {
        this.phoneByLid.set(lid, phone);
      }
    });
  }

  async start(reason = "manual_activate"): Promise<void> {
    this.desiredActive = true;
    recordDebugLog({
      event: "autoresponse_enabled",
      data: { reason, connection: this.connectionStatus },
    });
    await this.connect(reason);

    if (this.connectionStatus === "open") {
      this.updateServiceState("ACTIVE", reason);
    }
  }

  async stop(reason = "manual_deactivate"): Promise<void> {
    this.desiredActive = false;
    recordDebugLog({
      event: "autoresponse_disabled_socket_kept_alive",
      data: { reason, connection: this.connectionStatus },
    });
    this.updateServiceState(
      this.connectionStatus === "open" ? "ACTIVE" : "INACTIVE",
      reason,
    );
  }

  async shutdown(reason = "shutdown"): Promise<void> {
    this.isStopping = true;
    this.desiredActive = false;
    this.updateServiceState("STOPPING", reason);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }

    this.latestQr = null;
    this.connectionStatus = "close";
    this.updateServiceState("INACTIVE", "stopped");
  }

  async resetSession(reason = "reset_session"): Promise<void> {
    await this.shutdown(reason);
    await rm(this.config.whatsappAuthDir, { recursive: true, force: true });
    this.latestQr = null;
    this.phoneByLid.clear();
    this.messageCache.clear();
    resetSessionIssue();
    recordDebugLog({
      level: "warn",
      event: "whatsapp_auth_session_reset",
      data: { reason, authDir: this.config.whatsappAuthDir },
    });
    await this.connect(reason);
  }

  async sendSubscriptionMessage(params: {
    name: string;
    phone: string;
  }): Promise<string> {
    return this.sendTextMessage({
      phone: params.phone,
      text: `Hola ${params.name}, gracias por registrarte en La Mojarrería. Responde SI para confirmar tu registro y recibir tus papas gratis.`,
    });
  }

  async sendAlreadyRegisteredMessage(params: {
    phone: string;
  }): Promise<string> {
    return this.sendTextMessage({
      phone: params.phone,
      text: "Este número ya está registrado. Si aún no has pedido tus papas gratis, solo haz un pedido. Si ya las usaste, estate pendiente, pronto te enviaremos promociones.",
    });
  }

  async sendTextMessage(params: {
    phone: string;
    text: string;
  }): Promise<string> {
    if (!this.socket) {
      throw new Error("WhatsApp socket is not initialized");
    }

    if (this.connectionStatus !== "open") {
      throw new Error(
        `WhatsApp socket is not connected; current status is ${this.connectionStatus}`,
      );
    }

    const content: AnyMessageContent = {
      text: params.text,
    };

    const response = await this.socket.sendMessage(
      phoneToWhatsAppJid(params.phone),
      content,
    );
    const messageId = response?.key.id;

    if (!messageId) {
      throw new Error("WhatsApp did not return a message id");
    }

    if (response.message) {
      this.rememberMessage(messageId, response.message);
    }

    await recordConversationMessage({
      filePath: this.config.conversationStoreFile,
      phone: params.phone,
      text: params.text,
      messageId,
      direction: "outbound",
      timestamp: new Date().toISOString(),
    });

    return messageId;
  }

  getStatus(): {
    active: boolean;
    connected: boolean;
    connection: "connecting" | "open" | "close";
    hasQr: boolean;
    state: WaServiceState;
    lastChangedAt: string;
  } {
    return {
      active: this.desiredActive,
      connected: this.connectionStatus === "open",
      connection: this.connectionStatus,
      hasQr: this.latestQr !== null,
      state: this.serviceState,
      lastChangedAt: this.lastChangedAt,
    };
  }

  getLatestQr(): string | null {
    return this.latestQr;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isStopping) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isStopping) {
        return;
      }

      void this.connect("reconnect").catch((error: unknown) => {
        this.logger.error(
          { err: error },
          "failed to reconnect WhatsApp socket",
        );
        this.updateServiceState("ERROR", "reconnect_failed");
        this.scheduleReconnect();
      });
    }, 5000);
  }

  private updateServiceState(state: WaServiceState, reason: string): void {
    const stateChanged = this.serviceState !== state;
    this.serviceState = state;
    this.lastChangedAt = new Date().toISOString();

    if (!stateChanged && reason !== "startup") {
      return;
    }

    const status = this.getStatus();
    this.logger.info({ status, reason }, "WhatsApp service status changed");

    if (!this.statusChangeHandler) {
      return;
    }

    void Promise.resolve(this.statusChangeHandler(status, reason)).catch(
      (error: unknown) => {
        this.logger.error(
          { err: error, status, reason },
          "failed to notify WhatsApp service status change",
        );
      },
    );
  }

  private async handleMessagesUpsert(event: MessagesUpsert): Promise<void> {
    recordDebugLog({
      event: "baileys_messages_upsert",
      data: {
        type: event.type,
        messageCount: event.messages.length,
        messageIds: event.messages
          .map((message) => message.key.id)
          .filter(Boolean),
        remoteJids: event.messages
          .map((message) => message.key.remoteJid)
          .filter(Boolean),
      },
    });

    if (event.type !== "notify") {
      recordDebugLog({
        event: "baileys_messages_upsert_skipped",
        data: {
          reason: "not_notify",
          type: event.type,
          messageCount: event.messages.length,
        },
      });
      return;
    }

    await Promise.all(
      event.messages.map((message) => this.handleIncomingMessage(message)),
    );
  }

  private handleMessagesUpdate(updates: MessagesUpdate): void {
    for (const { key, update } of updates) {
      if (key.id && update.message) {
        this.rememberMessage(key.id, update.message);
      }

      this.logger.info(
        {
          messageId: key.id,
          remoteJid: key.remoteJid,
          fromMe: key.fromMe,
          status: update.status,
        },
        "WhatsApp message update",
      );
    }
  }

  private handleMessageReceiptUpdate(updates: MessageReceiptUpdate): void {
    for (const { key, receipt } of updates) {
      this.logger.info(
        {
          messageId: key.id,
          remoteJid: key.remoteJid,
          fromMe: key.fromMe,
          receipt,
        },
        "WhatsApp message receipt update",
      );
    }
  }

  private async handleIncomingMessage(
    message: proto.IWebMessageInfo & { key: { senderPn?: string } },
  ): Promise<void> {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid || remoteJid.endsWith("@g.us")) {
      recordDebugLog({
        event: "whatsapp_message_skipped_jid",
        data: {
          messageId: message.key.id,
          remoteJid,
          fromMe: message.key.fromMe,
          reason: !remoteJid ? "missing_remote_jid" : "group_message",
        },
      });
      return;
    }

    const phone =
      message.key.senderPn?.split("@")[0] ?? phoneFromWhatsAppJid(remoteJid);
    const text = getMessageText(message.message);
    const messageId = message.key.id;
    const direction = message.key.fromMe ? "outbound" : "inbound";

    if (messageId && message.message) {
      this.rememberMessage(messageId, message.message);
    }

    this.logger.info(
      {
        id: message.key.id,
        phone,
        text,
        direction,
        json: JSON.stringify(message, null, 2),
      },
      "received WhatsApp message",
    );
    recordDebugLog({
      event: "whatsapp_message_received",
      data: {
        messageId,
        phone,
        direction,
        hasText: Boolean(text),
        active: this.desiredActive,
        connection: this.connectionStatus,
      },
    });
    recordReceivedMessageLog({
      phone,
      source: "app_message",
      data: {
        messageId,
        direction,
        hasText: Boolean(text),
        remoteJid,
      },
    });
    if (!phone || !text || !messageId) {
      recordDebugLog({
        level: "warn",
        event: "whatsapp_message_skipped_missing_data",
        data: {
          messageId,
          phone,
          hasText: Boolean(text),
        },
      });
      return;
    }

    const timestamp = getMessageTimestamp(message);
    const conversationMessage = await recordConversationMessage({
      filePath: this.config.conversationStoreFile,
      phone,
      text,
      messageId,
      direction,
      timestamp,
    });
    recordDebugLog({
      event: "conversation_message_recorded",
      data: { messageId, phone, direction, timestamp },
    });
    if (direction === "outbound") {
      return;
    }

    const testPhone = await isAutoresponseTestPhone({
      filePath: this.config.autoresponseTestPhonesFile,
      phone,
    });

    if (!this.desiredActive && !testPhone) {
      this.logger.info(
        { remoteJid, messageId },
        "recorded inbound WhatsApp message without autoresponse because service is inactive",
      );
      recordDebugLog({
        event: "autoresponse_skipped_inactive",
        data: { messageId, phone },
      });
      return;
    }

    if (!this.desiredActive && testPhone) {
      recordDebugLog({
        event: "autoresponse_test_phone_bypass",
        data: { messageId, phone },
      });
    }

    await recordInboundContact({
      filePath: this.config.inboundContactsStoreFile,
      phone,
      text,
      messageId,
      receivedAt: timestamp,
    });

    try {
      this.logger.info(
        { phone, messageId },
        "requesting bot-service WhatsApp autoresponse",
      );
      const priorMessages = (
        await listConversationMessages({
          filePath: this.config.conversationStoreFile,
          phone,
          limit: 13,
        })
      )
        .filter((historyMessage) => historyMessage.id !== messageId)
        .slice(0, 12)
        .reverse();
      const botReply = await createBotReply({
        config: this.config,
        logger: this.logger,
        payload: {
          message: {
            id: messageId,
            text,
            timestamp,
          },
          history: priorMessages.map((historyMessage) => ({
            role: historyMessage.direction === "inbound" ? "user" : "assistant",
            text: historyMessage.text,
            timestamp: historyMessage.timestamp,
          })),
        },
      });

      if (!botReply?.shouldSend) {
        this.logger.info(
          { phone, messageId },
          "bot-service did not return a sendable WhatsApp reply",
        );
        recordDebugLog({
          event: "bot_reply_not_sent",
          data: { messageId, phone },
        });
      } else {
        const replyMessageId = await this.sendTextMessage({
          phone,
          text: botReply.text,
        });
        recordDebugLog({
          event: "bot_reply_sent",
          data: { messageId, phone, replyMessageId },
        });
        this.logger.info(
          { phone, messageId, replyMessageId },
          "sent bot-service WhatsApp reply",
        );
      }
    } catch (error) {
      this.logger.error(
        { err: error, phone, messageId },
        "failed to send bot-service WhatsApp reply",
      );
      recordDebugLog({
        level: "error",
        event: "bot_reply_send_failed",
        data: {
          messageId,
          phone,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    const existingRecord = await getRegistryRecord(
      this.config.registryStoreFile,
      phone,
    );
    const campaignKey =
      getCampaignForPhone(phone) ?? existingRecord?.campaignKey ?? null;
    const payload = {
      phone,
      text,
      messageId,
      timestamp,
      source: "baileys" as const,
      campaignKey,
    };

    const registryRecord = await activateRegistry({
      filePath: this.config.registryStoreFile,
      phone,
      campaignKey: payload.campaignKey,
    });
    if (registryRecord) {
      await activateDummyRegistry({
        baseUrl: this.config.dummyRegistryApiUrl,
        logger: this.logger,
        record: registryRecord,
      });
    }

    try {
      await notifySubscriptionReply(this.config, this.logger, payload);
      this.logger.info(
        { phone, messageId },
        "forwarded WhatsApp reply to main backend",
      );
    } catch (error) {
      this.logger.error(
        { err: error, phone, messageId },
        "failed to forward WhatsApp reply",
      );
    }

    await dispatchWebhookEvent({
      filePath: this.config.webhookSubscriptionsFile,
      logger: this.logger,
      event: "message.received",
      payload: {
        event: "message.received",
        provider: "baileys",
        message: conversationMessage,
      },
    });
  }

  private getPhoneFromRemoteJid(remoteJid: string): string | null {
    return (
      phoneFromWhatsAppJid(remoteJid) ?? this.phoneByLid.get(remoteJid) ?? null
    );
  }

  private rememberMessage(messageId: string, message: proto.IMessage): void {
    this.messageCache.set(messageId, message);

    if (this.messageCache.size <= 500) {
      return;
    }

    const oldestMessageId = this.messageCache.keys().next().value;
    if (oldestMessageId) {
      this.messageCache.delete(oldestMessageId);
    }
  }
}
