import { Router } from "express";
import type { Request } from "express";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import {
  createOpaqueToken,
  hashPassword,
  hashToken,
  signToken,
  verifyPassword,
  verifyToken,
} from "./auth.js";
import {
  ApiError,
  empty,
  ok,
  paginated,
  parsePagination,
  readOptionalString,
  requireString,
  slicePage,
} from "./http.js";
import {
  asyncHandler,
  rateLimit,
  requireAuth,
  requireAdminAuth,
  requireAdminRole,
  requireRole,
  requireWorkspace,
} from "./middleware.js";
import {
  contactView,
  conversationView,
  messageView,
  publicAdminUser,
  publicUser,
  whatsappAccountView,
  workspaceWithRole,
} from "./serializers.js";
import { botClient } from "./services/botClient.js";
import { whatsappClient } from "./services/whatsappClient.js";
import { id, now, type JsonStore } from "./store/jsonStore.js";
import type {
  AutomationRule,
  AdminRole,
  BotAssignmentMode,
  BusinessHour,
  ConversationStatus,
  Database,
  MatchType,
  Message,
  MessageType,
  Preferences,
  Role,
  TakuBotStatus,
  WhatsAppStatus,
} from "./types.js";
import type { Realtime } from "./realtime.js";

const ownerAdmin: Role[] = ["owner", "admin"];
const allRoles: Role[] = ["owner", "admin", "agent"];
const adminSuperRoles: AdminRole[] = ["super_owner", "super_admin"];
const adminManageUsersRoles: AdminRole[] = ["super_owner"];

function slugValid(slug: string) {
  return /^[a-z0-9-]+$/.test(slug);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function roleValid(value: unknown): value is Role {
  return value === "owner" || value === "admin" || value === "agent";
}

function statusValid(value: unknown): value is ConversationStatus {
  return (
    value === "open" ||
    value === "pending" ||
    value === "closed" ||
    value === "archived"
  );
}

function matchTypeValid(value: unknown): value is MatchType {
  return value === "exact" || value === "contains" || value === "starts_with";
}

function pageResponse<T>(items: T[], query: Record<string, unknown>) {
  const pagination = parsePagination(query);
  return {
    items: slicePage(items, pagination),
    pagination,
    total: items.length,
  };
}

function createTokens(userId: string) {
  const accessToken = signToken({ sub: userId }, config.jwtSecret, 60 * 15);
  const refreshToken = createOpaqueToken();
  return { accessToken, refreshToken };
}

function createAdminTokens(adminUserId: string) {
  const accessToken = signToken(
    { sub: adminUserId, scope: "admin" },
    config.adminJwtSecret,
    60 * 15,
  );
  const refreshToken = createOpaqueToken();
  return { accessToken, refreshToken };
}

function assertAdmin(req: Request) {
  if (!req.adminAuth) {
    throw new ApiError({
      status: 401,
      code: "ADMIN_UNAUTHORIZED",
      message: "Admin no autenticado.",
    });
  }
  return req.adminAuth.adminUser;
}

function createAdminLoginResult(
  database: Awaited<ReturnType<JsonStore["read"]>>,
  email: string,
  password: string,
  totpCode: string | null,
) {
  const adminUser = database.adminUsers.find(
    (item) => item.email.toLowerCase() === email,
  );
  if (!adminUser || !verifyPassword(password, adminUser.passwordHash))
    return null;
  if (adminUser.status !== "active") {
    throw new ApiError({
      status: 403,
      code: "ADMIN_FORBIDDEN",
      message: "Credenciales invalidas.",
    });
  }
  if (adminUser.requires2fa && adminUser.twoFactorEnabled && !totpCode) {
    throw new ApiError({
      status: 401,
      code: "ADMIN_2FA_REQUIRED",
      message: "Codigo 2FA requerido.",
    });
  }
  const tokens = createAdminTokens(adminUser.id);
  database.adminRefreshTokens.push({
    id: id("admin_refresh"),
    adminUserId: adminUser.id,
    tokenHash: hashToken(tokens.refreshToken, config.adminRefreshSecret),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    revokedAt: null,
    createdAt: now(),
  });
  adminUser.lastLoginAt = now();
  adminUser.updatedAt = now();
  return {
    sessionType: "admin" as const,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    adminUser: publicAdminUser(adminUser),
    requiresPasswordChange:
      adminUser.role === "super_owner" &&
      verifyPassword("changeme", adminUser.passwordHash),
  };
}

function createClientLoginResult(
  database: Awaited<ReturnType<JsonStore["read"]>>,
  email: string,
  password: string,
) {
  const user = database.users.find(
    (item) => item.email.toLowerCase() === email,
  );
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  if (user.status === "disabled") {
    throw new ApiError({
      status: 403,
      code: "USER_DISABLED",
      message: "Usuario deshabilitado.",
    });
  }
  const tokens = createTokens(user.id);
  database.refreshTokens.push({
    id: id("refresh"),
    userId: user.id,
    tokenHash: hashToken(tokens.refreshToken, config.refreshSecret),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    revokedAt: null,
    createdAt: now(),
  });
  user.lastLoginAt = now();
  user.updatedAt = now();
  const memberships = database.memberships.filter(
    (item) => item.userId === user.id && item.status === "active",
  );
  const workspaces = memberships
    .map((membership) => {
      const found = database.workspaces.find(
        (item) => item.id === membership.workspaceId,
      );
      return found ? workspaceWithRole(found, membership.role) : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const currentWorkspace = workspaces[0] ?? null;
  if (!currentWorkspace) {
    throw new ApiError({
      status: 403,
      code: "WORKSPACE_FORBIDDEN",
      message: "Usuario sin workspace activo.",
    });
  }
  return {
    sessionType: "client" as const,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: publicUser(user),
    role: currentWorkspace.role,
    currentWorkspace,
    workspaces,
  };
}

function createClientSessionForUser(
  database: Awaited<ReturnType<JsonStore["read"]>>,
  userId: string,
  workspaceId: string,
) {
  const user = database.users.find((item) => item.id === userId);
  if (!user || user.status !== "active") {
    throw new ApiError({
      status: 404,
      code: "USER_NOT_FOUND",
      message: "Usuario no encontrado.",
    });
  }
  const memberships = database.memberships.filter(
    (item) => item.userId === user.id && item.status === "active",
  );
  const workspaces = memberships
    .map((membership) => {
      const found = database.workspaces.find(
        (item) => item.id === membership.workspaceId,
      );
      return found ? workspaceWithRole(found, membership.role) : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const currentWorkspace =
    workspaces.find((item) => item.id === workspaceId) ?? null;
  if (!currentWorkspace) {
    throw new ApiError({
      status: 403,
      code: "WORKSPACE_FORBIDDEN",
      message: "Usuario sin acceso al workspace.",
    });
  }
  const tokens = createTokens(user.id);
  database.refreshTokens.push({
    id: id("refresh"),
    userId: user.id,
    tokenHash: hashToken(tokens.refreshToken, config.refreshSecret),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    revokedAt: null,
    createdAt: now(),
  });
  user.lastLoginAt = now();
  user.updatedAt = now();
  return {
    sessionType: "client" as const,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: publicUser(user),
    role: currentWorkspace.role,
    currentWorkspace,
    workspaces,
  };
}

function assertWorkspace(req: Request) {
  if (!req.auth || !req.workspaceContext) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "No autenticado.",
    });
  }
  return { user: req.auth.user, ...req.workspaceContext };
}

function findAccount(
  database: Awaited<ReturnType<JsonStore["read"]>>,
  workspaceId: string,
  accountId: string,
) {
  const account = database.whatsappAccounts.find(
    (item) => item.id === accountId && item.workspaceId === workspaceId,
  );
  if (!account) {
    throw new ApiError({
      status: 404,
      code: "WHATSAPP_ACCOUNT_NOT_FOUND",
      message: "Numero de WhatsApp no encontrado.",
    });
  }
  return account;
}

function findConversation(
  database: Awaited<ReturnType<JsonStore["read"]>>,
  workspaceId: string,
  conversationId: string,
) {
  const conversation = database.conversations.find(
    (item) => item.id === conversationId && item.workspaceId === workspaceId,
  );
  if (!conversation) {
    throw new ApiError({
      status: 404,
      code: "CONVERSATION_NOT_FOUND",
      message: "Conversacion no encontrada.",
    });
  }
  return conversation;
}

function botStatusValid(value: unknown): value is TakuBotStatus {
  return value === "draft" || value === "active" || value === "paused";
}

function botAssignmentModeValid(value: unknown): value is BotAssignmentMode {
  return (
    value === "disabled" ||
    value === "always" ||
    value === "business_hours" ||
    value === "outside_business_hours"
  );
}

function timeToMinutes(value: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function isBusinessOpen(
  database: Database,
  workspaceId: string,
  whatsappAccountId: string,
  date = new Date(),
) {
  const accountHours = database.businessHours.filter(
    (item) =>
      item.workspaceId === workspaceId &&
      item.whatsappAccountId === whatsappAccountId,
  );
  const hours = accountHours.length
    ? accountHours
    : database.businessHours.filter(
        (item) => item.workspaceId === workspaceId && !item.whatsappAccountId,
      );
  if (!hours.length) return true;
  const today = hours.find((item) => item.dayOfWeek === date.getDay());
  if (!today) return true;
  if (today.isClosed) return false;
  const opensAt = timeToMinutes(today.opensAt);
  const closesAt = timeToMinutes(today.closesAt);
  if (opensAt === null || closesAt === null) return true;
  const current = date.getHours() * 60 + date.getMinutes();
  return current >= opensAt && current < closesAt;
}

function ruleMatches(rule: AutomationRule, incomingText: string) {
  const text = incomingText.toLowerCase();
  const keyword = rule.keyword.toLowerCase();
  if (rule.matchType === "exact") return text === keyword;
  if (rule.matchType === "starts_with") return text.startsWith(keyword);
  return text.includes(keyword);
}

function findEffectiveBotSettings(
  database: Database,
  workspaceId: string,
  whatsappAccountId: string,
) {
  return (
    database.botSettings.find(
      (item) =>
        item.workspaceId === workspaceId &&
        item.whatsappAccountId === whatsappAccountId,
    ) ??
    database.botSettings.find(
      (item) => item.workspaceId === workspaceId && !item.whatsappAccountId,
    ) ??
    null
  );
}

function findMatchingAutomationRule(
  database: Database,
  workspaceId: string,
  whatsappAccountId: string,
  incomingText: string,
) {
  const scopedRules = database.automationRules.filter(
    (item) =>
      item.workspaceId === workspaceId &&
      item.enabled &&
      (item.whatsappAccountId === whatsappAccountId || !item.whatsappAccountId),
  );
  return scopedRules.find((rule) => ruleMatches(rule, incomingText)) ?? null;
}

function assignmentCanRespond(mode: BotAssignmentMode, isOpen: boolean) {
  if (mode === "disabled") return false;
  if (mode === "business_hours") return isOpen;
  if (mode === "outside_business_hours") return !isOpen;
  return true;
}

function signWebhookBody(body: unknown, secret: string, timestamp: string) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${JSON.stringify(body)}`)
    .digest("hex");
}

function validateWebhook(req: Request, secret: string) {
  const signature = req.header("X-Signature");
  const timestamp = req.header("X-Timestamp");
  if (!signature || !timestamp) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Firma requerida.",
    });
  }
  const timestampNumber = Number(timestamp);
  const timestampMs =
    timestampNumber > 10_000_000_000 ? timestampNumber : timestampNumber * 1000;
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000
  ) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Timestamp invalido.",
    });
  }
  const expected = signWebhookBody(req.body, secret, timestamp);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new ApiError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Firma invalida.",
    });
  }
}

export function createApiRouter(store: JsonStore, realtime: Realtime) {
  const router = Router();
  const auth = requireAuth(store);
  const workspace = requireWorkspace(store);
  const adminAuth = requireAdminAuth(store);

  async function sendAutomationReply(params: {
    workspaceId: string;
    accountId: string;
    conversationId: string;
    contactId: string;
    inboundMessageId: string;
    to: string;
    text: string;
    botId: string | null;
    assignmentId: string | null;
    reason: string;
  }) {
    const snapshot = await store.read();
    const account = findAccount(snapshot, params.workspaceId, params.accountId);
    let externalMessageId: string | null = null;
    let status: Message["status"] = "queued";
    try {
      const sent = await whatsappClient.sendTextMessage(
        account.externalInstanceId,
        params.to,
        params.text,
      );
      externalMessageId = sent.messageId ?? null;
      status = sent.status === "failed" ? "failed" : "sent";
    } catch {
      status = "failed";
    }

    const result = await store.update((database) => {
      const conversation = findConversation(
        database,
        params.workspaceId,
        params.conversationId,
      );
      const message: Message = {
        id: id("message"),
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        whatsappAccountId: params.accountId,
        contactId: params.contactId,
        externalMessageId,
        direction: "bot",
        type: "text",
        body: params.text,
        mediaUrl: null,
        mediaMimeType: null,
        mediaFilename: null,
        status,
        sentByUserId: null,
        createdAt: now(),
        updatedAt: now(),
      };
      database.messages.push(message);
      database.automationDecisionLogs.push({
        id: id("automation_decision"),
        workspaceId: params.workspaceId,
        whatsappAccountId: params.accountId,
        conversationId: params.conversationId,
        messageId: params.inboundMessageId,
        botId: params.botId,
        assignmentId: params.assignmentId,
        decision: params.botId ? "bot_reply" : "static_reply",
        reason: params.reason,
        responseText: params.text,
        createdAt: now(),
      });
      conversation.lastMessageBody = params.text;
      conversation.lastMessageAt = message.createdAt;
      conversation.updatedAt = now();
      return {
        message: messageView(message, database),
        conversation: conversationView(conversation, database),
      };
    });
    realtime.emitToWorkspace(params.workspaceId, "message.created", {
      conversationId: params.conversationId,
      message: result.message,
    });
    realtime.emitToWorkspace(
      params.workspaceId,
      "conversation.updated",
      result.conversation,
    );
  }

  async function runAutomationDecision(params: {
    workspaceId: string;
    accountId: string;
    conversationId: string;
    contactId: string;
    inboundMessageId: string;
    from: string;
    text: string;
  }) {
    const database = await store.read();
    const workspaceRecord = database.workspaces.find(
      (item) => item.id === params.workspaceId,
    );
    const account = findAccount(database, params.workspaceId, params.accountId);
    const settings = findEffectiveBotSettings(
      database,
      params.workspaceId,
      params.accountId,
    );
    if (!workspaceRecord || workspaceRecord.status === "suspended") {
      await store.update((current) => {
        current.automationDecisionLogs.push({
          id: id("automation_decision"),
          workspaceId: params.workspaceId,
          whatsappAccountId: params.accountId,
          conversationId: params.conversationId,
          messageId: params.inboundMessageId,
          botId: null,
          assignmentId: null,
          decision: "blocked",
          reason: "workspace_not_active",
          responseText: null,
          createdAt: now(),
        });
      });
      return;
    }
    if (!account.enabled || !settings?.enabled) return;

    const isOpen = isBusinessOpen(
      database,
      params.workspaceId,
      params.accountId,
    );
    const rule = settings.rulesEnabled
      ? findMatchingAutomationRule(
          database,
          params.workspaceId,
          params.accountId,
          params.text,
        )
      : null;
    if (rule) {
      await sendAutomationReply({
        ...params,
        to: params.from,
        text: rule.responseText,
        botId: null,
        assignmentId: null,
        reason: `automation_rule:${rule.id}`,
      });
      return;
    }

    if (settings.afterHoursEnabled && !isOpen && settings.afterHoursMessage) {
      await sendAutomationReply({
        ...params,
        to: params.from,
        text: settings.afterHoursMessage,
        botId: null,
        assignmentId: null,
        reason: "after_hours",
      });
      return;
    }

    const assignment = database.botAssignments.find(
      (item) =>
        item.workspaceId === params.workspaceId &&
        item.whatsappAccountId === params.accountId &&
        item.enabled &&
        assignmentCanRespond(item.mode, isOpen),
    );
    const bot = assignment
      ? database.bots.find(
          (item) =>
            item.id === assignment.botId &&
            item.workspaceId === params.workspaceId &&
            item.status === "active",
        )
      : null;
    if (
      !settings.aiEnabled ||
      !assignment ||
      !bot?.clientId ||
      !bot.clientToken
    ) {
      return;
    }

    try {
      const history = database.messages
        .filter((item) => item.conversationId === params.conversationId)
        .filter((item) => item.body)
        .slice(-10)
        .map((item) => ({
          role:
            item.direction === "inbound"
              ? ("user" as const)
              : ("assistant" as const),
          content: item.body ?? "",
        }));
      const completion = await botClient.createCompletion({
        clientId: bot.clientId,
        clientToken: bot.clientToken,
        assistantId: bot.externalAssistantId,
        history,
        messages: [{ role: "user", content: params.text }],
      });
      const reply = completion.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error("Bot completion did not include reply text");
      await sendAutomationReply({
        ...params,
        to: params.from,
        text: reply,
        botId: bot.id,
        assignmentId: assignment.id,
        reason: "bot_assignment",
      });
    } catch (error) {
      await store.update((current) => {
        current.automationDecisionLogs.push({
          id: id("automation_decision"),
          workspaceId: params.workspaceId,
          whatsappAccountId: params.accountId,
          conversationId: params.conversationId,
          messageId: params.inboundMessageId,
          botId: bot?.id ?? null,
          assignmentId: assignment.id,
          decision: "error",
          reason: error instanceof Error ? error.message : "bot_error",
          responseText: null,
          createdAt: now(),
        });
      });
    }
  }

  router.get("/health", (_req, res) => {
    ok(res, { status: "ok", timestamp: now() });
  });

  router.get(
    "/health/ready",
    asyncHandler(async (_req, res) => {
      await store.read();
      ok(res, {
        status: "ready",
        services: {
          postgres: "json-store",
          whatsappService: config.takuWaApiKey
            ? "configured"
            : "missing_api_key",
          botService: config.botServiceApiKey
            ? "configured"
            : "missing_api_key",
          realtime: "ok",
        },
      });
    }),
  );

  router.post(
    "/webhooks/whatsapp",
    asyncHandler(async (req, res) => {
      validateWebhook(req, config.takuWaWebhookSecret);
      const event = requireString(req.body?.event, "event");
      const connectionId = requireString(
        req.body?.connectionId,
        "connectionId",
      );
      const payload =
        req.body?.data && typeof req.body.data === "object"
          ? (req.body.data as Record<string, unknown>)
          : {};
      const result = await store.update((database) => {
        const account = database.whatsappAccounts.find(
          (item) => item.externalInstanceId === connectionId,
        );
        if (!account)
          throw new ApiError({
            status: 404,
            code: "WHATSAPP_ACCOUNT_NOT_FOUND",
            message: "Conexion no encontrada.",
          });

        if (event === "message.received") {
          const from = requireString(payload.from, "from");
          const text = readOptionalString(payload.text) ?? "";
          const externalMessageId = readOptionalString(payload.messageId);
          if (
            externalMessageId &&
            database.messages.some(
              (item) =>
                item.workspaceId === account.workspaceId &&
                item.externalMessageId === externalMessageId &&
                item.direction === "inbound",
            )
          ) {
            return {
              workspaceId: account.workspaceId,
              duplicate: true,
            };
          }
          let contact = database.contacts.find(
            (item) =>
              item.workspaceId === account.workspaceId &&
              item.phoneNumber === from,
          );
          if (!contact) {
            contact = {
              id: id("contact"),
              workspaceId: account.workspaceId,
              phoneNumber: from,
              name: readOptionalString(payload.profileName) ?? null,
              profilePictureUrl: null,
              notes: null,
              createdAt: now(),
              updatedAt: now(),
            };
            database.contacts.push(contact);
          }
          let conversation = database.conversations.find(
            (item) =>
              item.workspaceId === account.workspaceId &&
              item.whatsappAccountId === account.id &&
              item.contactId === contact?.id,
          );
          if (!conversation) {
            conversation = {
              id: id("conversation"),
              workspaceId: account.workspaceId,
              whatsappAccountId: account.id,
              contactId: contact.id,
              status: "open",
              lastMessageBody: text,
              lastMessageAt: now(),
              assignedUserId: null,
              unreadCount: 0,
              createdAt: now(),
              updatedAt: now(),
            };
            database.conversations.push(conversation);
          }
          const message: Message = {
            id: id("message"),
            workspaceId: account.workspaceId,
            conversationId: conversation.id,
            whatsappAccountId: account.id,
            contactId: contact.id,
            externalMessageId: externalMessageId ?? null,
            direction: "inbound",
            type: (readOptionalString(payload.type) ?? "text") as MessageType,
            body: text,
            mediaUrl: null,
            mediaMimeType: null,
            mediaFilename: null,
            status: "received",
            sentByUserId: null,
            createdAt: now(),
            updatedAt: now(),
          };
          database.messages.push(message);
          conversation.lastMessageBody = text;
          conversation.lastMessageAt = message.createdAt;
          conversation.unreadCount += 1;
          conversation.updatedAt = now();
          return {
            workspaceId: account.workspaceId,
            accountId: account.id,
            contactId: contact.id,
            conversationId: conversation.id,
            from,
            text,
            inboundMessageId: message.id,
            message: messageView(message, database),
            conversation: conversationView(conversation, database),
          };
        }

        if (event.startsWith("message.")) {
          const messageId = readOptionalString(payload.messageId);
          if (messageId) {
            const message = database.messages.find(
              (item) =>
                item.externalMessageId === messageId &&
                item.workspaceId === account.workspaceId,
            );
            if (message) {
              message.status = (readOptionalString(payload.status) ??
                event.replace("message.", "")) as Message["status"];
              message.updatedAt = now();
              return {
                workspaceId: account.workspaceId,
                message: messageView(message, database),
              };
            }
          }
        }

        if (event.startsWith("connection.")) {
          const statusMap: Record<string, WhatsAppStatus> = {
            open: "connected",
            connected: "connected",
            close: "disconnected",
            disconnected: "disconnected",
            connecting: "connecting",
            qr: "qr_required",
            failed: "failed",
          };
          const rawStatus =
            readOptionalString(payload.status) ??
            event.replace("connection.", "");
          account.status = statusMap[rawStatus] ?? account.status;
          account.phoneNumber =
            readOptionalString(payload.phoneNumber) ?? account.phoneNumber;
          if (account.status === "connected") account.lastConnectedAt = now();
          if (account.status === "disconnected")
            account.lastDisconnectedAt = now();
          account.updatedAt = now();
          return {
            workspaceId: account.workspaceId,
            account: whatsappAccountView(account, database),
          };
        }
        return { workspaceId: account.workspaceId };
      });

      if ("message" in result)
        realtime.emitToWorkspace(result.workspaceId, "message.created", result);
      if ("conversation" in result)
        realtime.emitToWorkspace(
          result.workspaceId,
          "conversation.updated",
          result.conversation,
        );
      if ("account" in result)
        realtime.emitToWorkspace(
          result.workspaceId,
          "whatsapp.status.updated",
          result.account,
        );
      if (
        "inboundMessageId" in result &&
        "accountId" in result &&
        "conversationId" in result &&
        "contactId" in result &&
        typeof result.workspaceId === "string" &&
        typeof result.accountId === "string" &&
        typeof result.conversationId === "string" &&
        typeof result.contactId === "string" &&
        typeof result.inboundMessageId === "string" &&
        typeof result.from === "string" &&
        typeof result.text === "string"
      ) {
        void runAutomationDecision({
          workspaceId: result.workspaceId,
          accountId: result.accountId,
          conversationId: result.conversationId,
          contactId: result.contactId,
          inboundMessageId: result.inboundMessageId,
          from: result.from,
          text: result.text,
        });
      }
      ok(res, { received: true, duplicate: "duplicate" in result });
    }),
  );

  router.get("/runtime/status", (req, res) => {
    const statusPassword = req.header("x-taku-status-password") ?? "";
    if (statusPassword !== config.superAdminPassword) {
      throw new ApiError({
        status: 403,
        code: "STATUS_PASSWORD_REQUIRED",
        message: "TAKU superadmin password required.",
      });
    }

    const configured = (value: string | null | undefined) => Boolean(value);

    ok(res, {
      service: "taku-backend",
      checkedAt: now(),
      runtime: {
        environment: config.environment,
        host: config.host,
        port: config.port,
        dataFile: config.dataFile,
        allowedOrigins: config.allowedOrigins,
        publicBaseUrl: config.publicBaseUrl,
        takuWaBaseUrl: config.takuWaBaseUrl,
        takuWaClientDomain: config.takuWaClientDomain,
        botServiceBaseUrl: config.botServiceBaseUrl,
      },
      variables: [
        {
          name: "TAKU_BACKEND_ENV",
          configured: configured(config.environment),
          required: true,
        },
        {
          name: "TAKU_BACKEND_DATA_FILE",
          configured: configured(config.dataFile),
          required: true,
        },
        {
          name: "TAKU_BACKEND_JWT_SECRET",
          configured: configured(config.jwtSecret),
          required: true,
        },
        {
          name: "TAKU_BACKEND_ADMIN_JWT_SECRET",
          configured: configured(config.adminJwtSecret),
          required: true,
        },
        {
          name: "TAKU_BACKEND_REFRESH_SECRET",
          configured: configured(config.refreshSecret),
          required: true,
        },
        {
          name: "TAKU_BACKEND_ADMIN_REFRESH_SECRET",
          configured: configured(config.adminRefreshSecret),
          required: true,
        },
        {
          name: "TAKU_BACKEND_ALLOWED_ORIGINS",
          configured: config.allowedOrigins.length > 0,
          required: true,
        },
        {
          name: "TAKU_BACKEND_PUBLIC_BASE_URL",
          configured: configured(config.publicBaseUrl),
          required: true,
        },
        {
          name: "TAKU_BACKEND_SUPERADMIN_EMAIL or SUPERADMIN_EMAIL",
          configured: configured(config.superAdminEmail),
          required: true,
        },
        {
          name: "TAKU_BACKEND_SUPERADMIN_PASSWORD or SUPERADMIN_PASSWORD",
          configured: configured(config.superAdminPassword),
          required: true,
        },
        {
          name: "TAKU_WA_BASE_URL",
          configured: configured(config.takuWaBaseUrl),
          required: true,
        },
        {
          name: "TAKU_WA_API_KEY",
          configured: configured(config.takuWaApiKey),
          required: true,
        },
        {
          name: "TAKU_WA_CLIENT_DOMAIN",
          configured: configured(config.takuWaClientDomain),
          required: true,
        },
        {
          name: "TAKU_WA_WEBHOOK_SECRET",
          configured: configured(config.takuWaWebhookSecret),
          required: true,
        },
        {
          name: "BOT_SERVICE_BASE_URL",
          configured: configured(config.botServiceBaseUrl),
          required: true,
        },
        {
          name: "BOT_SERVICE_API_KEY",
          configured: configured(config.botServiceApiKey),
          required: true,
        },
        {
          name: "BOT_SERVICE_WEBHOOK_SECRET",
          configured: configured(config.botServiceWebhookSecret),
          required: true,
        },
      ],
    });
  });

  router.post(
    "/session/login",
    rateLimit({
      key: (req) => `session-login:${req.ip}:${String(req.body?.email ?? "")}`,
      limit: 8,
      windowMs: 60_000,
    }),
    asyncHandler(async (req, res) => {
      const email = requireString(req.body?.email, "email").toLowerCase();
      const password = requireString(req.body?.password, "password");
      const totpCode = readOptionalString(req.body?.totpCode) ?? null;
      const result = await store.update((database) => {
        const adminResult = createAdminLoginResult(
          database,
          email,
          password,
          totpCode,
        );
        if (adminResult) return adminResult;
        const clientResult = createClientLoginResult(database, email, password);
        if (clientResult) return clientResult;
        throw new ApiError({
          status: 401,
          code: "INVALID_CREDENTIALS",
          message: "Credenciales invalidas.",
        });
      });
      if (result.sessionType === "admin") {
        await store.adminAudit({
          adminUserId: result.adminUser.id,
          action: "super_admin.auth.login",
          targetType: "admin_user",
          targetId: result.adminUser.id,
          workspaceId: null,
          reason: null,
          metadata: { unified: true },
          ip: req.ip ?? null,
          userAgent: req.header("user-agent") ?? null,
        });
      } else {
        await store.audit({
          workspaceId: result.currentWorkspace.id,
          userId: result.user.id,
          action: "auth.login",
          entityType: "user",
          entityId: result.user.id,
          metadata: { unified: true },
        });
      }
      ok(res, result);
    }),
  );

  router.post(
    "/admin/auth/login",
    rateLimit({
      key: (req) => `admin-login:${req.ip}:${String(req.body?.email ?? "")}`,
      limit: 5,
      windowMs: 60_000,
    }),
    asyncHandler(async (req, res) => {
      const email = requireString(req.body?.email, "email").toLowerCase();
      const password = requireString(req.body?.password, "password");
      const totpCode = readOptionalString(req.body?.totpCode) ?? null;
      const result = await store.update((database) => {
        const adminResult = createAdminLoginResult(
          database,
          email,
          password,
          totpCode,
        );
        if (!adminResult) {
          throw new ApiError({
            status: 401,
            code: "ADMIN_UNAUTHORIZED",
            message: "Credenciales invalidas.",
          });
        }
        return adminResult;
      });
      await store.adminAudit({
        adminUserId: result.adminUser.id,
        action: "super_admin.auth.login",
        targetType: "admin_user",
        targetId: result.adminUser.id,
        workspaceId: null,
        reason: null,
        metadata: null,
        ip: req.ip ?? null,
        userAgent: req.header("user-agent") ?? null,
      });
      ok(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        adminUser: result.adminUser,
        requiresPasswordChange: result.requiresPasswordChange,
      });
    }),
  );

  router.post(
    "/admin/auth/refresh",
    asyncHandler(async (req, res) => {
      const refreshToken = requireString(
        req.body?.refreshToken,
        "refreshToken",
      );
      const tokenHash = hashToken(refreshToken, config.adminRefreshSecret);
      const result = await store.update((database) => {
        const stored = database.adminRefreshTokens.find(
          (item) => item.tokenHash === tokenHash && !item.revokedAt,
        );
        if (!stored || stored.expiresAt < now()) {
          throw new ApiError({
            status: 401,
            code: "ADMIN_UNAUTHORIZED",
            message: "Refresh token admin invalido.",
          });
        }
        stored.revokedAt = now();
        const adminUser = database.adminUsers.find(
          (item) => item.id === stored.adminUserId,
        );
        if (!adminUser || adminUser.status !== "active") {
          throw new ApiError({
            status: 401,
            code: "ADMIN_UNAUTHORIZED",
            message: "Admin no autenticado.",
          });
        }
        const tokens = createAdminTokens(adminUser.id);
        database.adminRefreshTokens.push({
          id: id("admin_refresh"),
          adminUserId: adminUser.id,
          tokenHash: hashToken(tokens.refreshToken, config.adminRefreshSecret),
          expiresAt: new Date(
            Date.now() + 1000 * 60 * 60 * 24 * 30,
          ).toISOString(),
          revokedAt: null,
          createdAt: now(),
        });
        return tokens;
      });
      ok(res, result);
    }),
  );

  router.post(
    "/admin/auth/logout",
    adminAuth,
    asyncHandler(async (req, res) => {
      const adminUser = assertAdmin(req);
      const refreshToken = readOptionalString(req.body?.refreshToken);
      if (refreshToken) {
        const tokenHash = hashToken(refreshToken, config.adminRefreshSecret);
        await store.update((database) => {
          const stored = database.adminRefreshTokens.find(
            (item) => item.tokenHash === tokenHash,
          );
          if (stored) stored.revokedAt = now();
        });
      }
      await store.adminAudit({
        adminUserId: adminUser.id,
        action: "super_admin.auth.logout",
        targetType: "admin_user",
        targetId: adminUser.id,
        workspaceId: null,
        reason: null,
        metadata: null,
        ip: req.ip ?? null,
        userAgent: req.header("user-agent") ?? null,
      });
      empty(res);
    }),
  );

  router.get("/admin/auth/me", adminAuth, (req, res) => {
    ok(res, { adminUser: publicAdminUser(assertAdmin(req)) });
  });

  router.post(
    "/admin/auth/change-password",
    adminAuth,
    asyncHandler(async (req, res) => {
      const adminUser = assertAdmin(req);
      const currentPassword = requireString(
        req.body?.currentPassword,
        "currentPassword",
      );
      const newPassword = requireString(req.body?.newPassword, "newPassword");
      const confirmation = requireString(
        req.body?.passwordConfirmation,
        "passwordConfirmation",
      );
      if (newPassword.length < 8 || newPassword !== confirmation) {
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message:
            "El nuevo password debe tener al menos 8 caracteres y coincidir.",
        });
      }
      if (newPassword === "changeme") {
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "El nuevo password no puede ser changeme.",
        });
      }
      const updated = await store.update((database) => {
        const stored = database.adminUsers.find(
          (item) => item.id === adminUser.id,
        );
        if (!stored || !verifyPassword(currentPassword, stored.passwordHash)) {
          throw new ApiError({
            status: 401,
            code: "ADMIN_UNAUTHORIZED",
            message: "Password actual invalido.",
          });
        }
        stored.passwordHash = hashPassword(newPassword);
        stored.updatedAt = now();
        return stored;
      });
      await store.adminAudit({
        adminUserId: updated.id,
        action: "super_admin.auth.password_changed",
        targetType: "admin_user",
        targetId: updated.id,
        workspaceId: null,
        reason: "Password inicial actualizado.",
        metadata: null,
        ip: req.ip ?? null,
        userAgent: req.header("user-agent") ?? null,
      });
      ok(res, {
        adminUser: publicAdminUser(updated),
        requiresPasswordChange: false,
      });
    }),
  );

  router.use("/admin", adminAuth);

  router.get(
    "/admin",
    asyncHandler(async (_req, res) => {
      const database = await store.read();
      const today = new Date().toISOString().slice(0, 10);
      ok(res, {
        workspaces: {
          total: database.workspaces.length,
          active: database.workspaces.filter((item) => item.status === "active")
            .length,
          trial: database.workspaces.filter((item) => item.status === "trial")
            .length,
          suspended: database.workspaces.filter(
            (item) => item.status === "suspended",
          ).length,
        },
        users: { total: database.users.length },
        whatsappAccounts: {
          total: database.whatsappAccounts.length,
          connected: database.whatsappAccounts.filter(
            (item) => item.status === "connected",
          ).length,
          disconnected: database.whatsappAccounts.filter(
            (item) => item.status === "disconnected",
          ).length,
        },
        messages: {
          sentToday: database.messages.filter(
            (item) =>
              item.direction === "outbound" && item.createdAt.startsWith(today),
          ).length,
          receivedToday: database.messages.filter(
            (item) =>
              item.direction === "inbound" && item.createdAt.startsWith(today),
          ).length,
          botToday: database.messages.filter(
            (item) =>
              item.direction === "bot" && item.createdAt.startsWith(today),
          ).length,
        },
        services: {
          postgres: "json-store",
          whatsappService: config.takuWaApiKey
            ? "configured"
            : "missing_api_key",
          botService: config.botServiceApiKey
            ? "configured"
            : "missing_api_key",
          realtime: "ok",
        },
      });
    }),
  );

  router.get(
    "/admin/workspaces",
    asyncHandler(async (req, res) => {
      const database = await store.read();
      const search = readOptionalString(req.query.search)?.toLowerCase();
      const status = readOptionalString(req.query.status);
      const plan = readOptionalString(req.query.plan);
      const hasDisconnectedNumbers =
        req.query.hasDisconnectedNumbers === "true";
      const rows = database.workspaces
        .filter((item) =>
          search
            ? `${item.name} ${item.slug}`.toLowerCase().includes(search)
            : true,
        )
        .filter((item) => (status ? item.status === status : true))
        .filter((item) => (plan ? item.plan === plan : true))
        .filter((item) => {
          if (!hasDisconnectedNumbers) return true;
          return database.whatsappAccounts.some(
            (account) =>
              account.workspaceId === item.id && account.status !== "connected",
          );
        })
        .map((workspaceItem) => {
          const workspaceUsers = database.memberships.filter(
            (membership) => membership.workspaceId === workspaceItem.id,
          );
          const accounts = database.whatsappAccounts.filter(
            (account) => account.workspaceId === workspaceItem.id,
          );
          return {
            ...workspaceItem,
            users: workspaceUsers.length,
            whatsappAccounts: accounts.length,
            connectedWhatsappAccounts: accounts.filter(
              (account) => account.status === "connected",
            ).length,
            messagesToday: database.messages.filter(
              (message) =>
                message.workspaceId === workspaceItem.id &&
                message.createdAt.startsWith(
                  new Date().toISOString().slice(0, 10),
                ),
            ).length,
            lastActivityAt:
              database.messages
                .filter((message) => message.workspaceId === workspaceItem.id)
                .sort((left, right) =>
                  right.createdAt.localeCompare(left.createdAt),
                )[0]?.createdAt ?? null,
          };
        });
      const page = pageResponse(rows, req.query);
      paginated(res, page.items, { ...page.pagination, total: page.total });
    }),
  );

  router.get(
    "/admin/workspaces/:workspaceId",
    asyncHandler(async (req, res) => {
      const database = await store.read();
      const workspaceItem = database.workspaces.find(
        (item) => item.id === req.params.workspaceId,
      );
      if (!workspaceItem) {
        throw new ApiError({
          status: 404,
          code: "WORKSPACE_NOT_FOUND",
          message: "Workspace no encontrado.",
        });
      }
      const accounts = database.whatsappAccounts.filter(
        (account) => account.workspaceId === workspaceItem.id,
      );
      ok(res, {
        ...workspaceItem,
        users: database.memberships
          .filter((membership) => membership.workspaceId === workspaceItem.id)
          .map((membership) => {
            const user = database.users.find(
              (item) => item.id === membership.userId,
            );
            return user
              ? {
                  ...publicUser(user),
                  role: membership.role,
                  membershipStatus: membership.status,
                }
              : null;
          })
          .filter(Boolean),
        whatsappAccounts: accounts.map((account) =>
          whatsappAccountView(account, database),
        ),
        conversations: database.conversations.filter(
          (conversation) => conversation.workspaceId === workspaceItem.id,
        ).length,
        automation: database.botSettings.filter(
          (settings) => settings.workspaceId === workspaceItem.id,
        ),
      });
    }),
  );

  router.post(
    "/admin/workspaces/:workspaceId/owner-session",
    requireAdminRole(adminSuperRoles),
    asyncHandler(async (req, res) => {
      const adminUser = assertAdmin(req);
      const result = await store.update((database) => {
        const workspaceItem = database.workspaces.find(
          (item) => item.id === req.params.workspaceId,
        );
        if (!workspaceItem) {
          throw new ApiError({
            status: 404,
            code: "WORKSPACE_NOT_FOUND",
            message: "Workspace no encontrado.",
          });
        }
        const shadowUserId = `admin_owner_${adminUser.id}`;
        let user = database.users.find((item) => item.id === shadowUserId);
        if (!user) {
          user = {
            id: shadowUserId,
            name: `${adminUser.name} (Superowner)`,
            email: `superowner+${adminUser.id}@taku.internal`,
            passwordHash: hashPassword(createOpaqueToken()),
            status: "active",
            lastLoginAt: null,
            createdAt: now(),
            updatedAt: now(),
          };
          database.users.push(user);
        } else {
          user.name = `${adminUser.name} (Superowner)`;
          user.status = "active";
          user.updatedAt = now();
        }
        let membership = database.memberships.find(
          (item) =>
            item.workspaceId === workspaceItem.id && item.userId === user.id,
        );
        if (!membership) {
          membership = {
            id: id("membership"),
            workspaceId: workspaceItem.id,
            userId: user.id,
            role: "owner",
            status: "active",
            invitationSentAt: null,
            createdAt: now(),
            updatedAt: now(),
          };
          database.memberships.push(membership);
        } else {
          membership.role = "owner";
          membership.status = "active";
          membership.updatedAt = now();
        }
        return createClientSessionForUser(database, user.id, workspaceItem.id);
      });
      await store.adminAudit({
        adminUserId: adminUser.id,
        action: "super_admin.workspace.owner_session_created",
        targetType: "workspace",
        targetId: req.params.workspaceId,
        workspaceId: req.params.workspaceId,
        reason: "Superowner requested owner UI access.",
        metadata: { impersonatedUserId: result.user.id },
        ip: req.ip ?? null,
        userAgent: req.header("user-agent") ?? null,
      });
      ok(res, result, 201);
    }),
  );

  router.patch(
    "/admin/workspaces/:workspaceId",
    requireAdminRole(adminSuperRoles),
    asyncHandler(async (req, res) => {
      const adminUser = assertAdmin(req);
      const updated = await store.update((database) => {
        const workspaceItem = database.workspaces.find(
          (item) => item.id === req.params.workspaceId,
        );
        if (!workspaceItem) {
          throw new ApiError({
            status: 404,
            code: "WORKSPACE_NOT_FOUND",
            message: "Workspace no encontrado.",
          });
        }
        const name = readOptionalString(req.body?.name);
        const slug = readOptionalString(req.body?.slug);
        const status = readOptionalString(req.body?.status);
        const plan = readOptionalString(req.body?.plan);
        const timezone = readOptionalString(req.body?.timezone);
        if (name) workspaceItem.name = name;
        if (slug) {
          if (!slugValid(slug))
            throw new ApiError({
              status: 400,
              code: "VALIDATION_ERROR",
              message: "Slug invalido.",
            });
          const duplicate = database.workspaces.some(
            (item) => item.slug === slug && item.id !== workspaceItem.id,
          );
          if (duplicate)
            throw new ApiError({
              status: 409,
              code: "WORKSPACE_SLUG_EXISTS",
              message: "Slug duplicado.",
            });
          workspaceItem.slug = slug;
        }
        if (
          status === "trial" ||
          status === "active" ||
          status === "suspended" ||
          status === "cancelled"
        )
          workspaceItem.status = status;
        if (plan === "starter" || plan === "business" || plan === "enterprise")
          workspaceItem.plan = plan;
        if (timezone) workspaceItem.timezone = timezone;
        workspaceItem.updatedAt = now();
        return workspaceItem;
      });
      await store.adminAudit({
        adminUserId: adminUser.id,
        action: "super_admin.workspace.updated",
        targetType: "workspace",
        targetId: updated.id,
        workspaceId: updated.id,
        reason: readOptionalString(req.body?.reason) ?? null,
        metadata: { patch: req.body },
        ip: req.ip ?? null,
        userAgent: req.header("user-agent") ?? null,
      });
      ok(res, updated);
    }),
  );

  router.post(
    "/admin/workspaces/:workspaceId/suspend",
    requireAdminRole(adminSuperRoles),
    asyncHandler(async (req, res) => {
      const adminUser = assertAdmin(req);
      const reason = readOptionalString(req.body?.reason);
      const comment = readOptionalString(req.body?.comment);
      if (!reason || !comment)
        throw new ApiError({
          status: 400,
          code: "SUPPORT_REASON_REQUIRED",
          message: "Motivo y comentario requeridos.",
        });
      const updated = await store.update((database) => {
        const workspaceItem = database.workspaces.find(
          (item) => item.id === req.params.workspaceId,
        );
        if (!workspaceItem)
          throw new ApiError({
            status: 404,
            code: "WORKSPACE_NOT_FOUND",
            message: "Workspace no encontrado.",
          });
        if (workspaceItem.status === "suspended")
          throw new ApiError({
            status: 409,
            code: "WORKSPACE_ALREADY_SUSPENDED",
            message: "Workspace ya suspendido.",
          });
        workspaceItem.status = "suspended";
        workspaceItem.updatedAt = now();
        return workspaceItem;
      });
      await store.adminAudit({
        adminUserId: adminUser.id,
        action: "super_admin.workspace.suspended",
        targetType: "workspace",
        targetId: updated.id,
        workspaceId: updated.id,
        reason,
        metadata: {
          comment,
          notifyCustomer: Boolean(req.body?.notifyCustomer),
        },
        ip: req.ip ?? null,
        userAgent: req.header("user-agent") ?? null,
      });
      ok(res, updated);
    }),
  );

  router.post(
    "/admin/workspaces/:workspaceId/reactivate",
    requireAdminRole(adminSuperRoles),
    asyncHandler(async (req, res) => {
      const adminUser = assertAdmin(req);
      const updated = await store.update((database) => {
        const workspaceItem = database.workspaces.find(
          (item) => item.id === req.params.workspaceId,
        );
        if (!workspaceItem)
          throw new ApiError({
            status: 404,
            code: "WORKSPACE_NOT_FOUND",
            message: "Workspace no encontrado.",
          });
        if (workspaceItem.status !== "suspended")
          throw new ApiError({
            status: 409,
            code: "WORKSPACE_NOT_SUSPENDED",
            message: "Workspace no esta suspendido.",
          });
        workspaceItem.status = "active";
        workspaceItem.updatedAt = now();
        return workspaceItem;
      });
      await store.adminAudit({
        adminUserId: adminUser.id,
        action: "super_admin.workspace.reactivated",
        targetType: "workspace",
        targetId: updated.id,
        workspaceId: updated.id,
        reason:
          readOptionalString(req.body?.comment) ??
          "Reactivacion solicitada por admin.",
        metadata: null,
        ip: req.ip ?? null,
        userAgent: req.header("user-agent") ?? null,
      });
      ok(res, updated);
    }),
  );

  router.get(
    "/admin/admin-users",
    requireAdminRole(adminManageUsersRoles),
    asyncHandler(async (_req, res) => {
      const database = await store.read();
      ok(res, database.adminUsers.map(publicAdminUser));
    }),
  );

  router.post(
    "/admin/admin-users",
    requireAdminRole(adminManageUsersRoles),
    asyncHandler(async (req, res) => {
      const adminUser = assertAdmin(req);
      const name = requireString(req.body?.name, "name");
      const email = requireString(req.body?.email, "email").toLowerCase();
      const role = requireString(req.body?.role, "role") as AdminRole;
      const allowedRoles: AdminRole[] = [
        "super_admin",
        "support_admin",
        "billing_admin",
        "readonly_admin",
      ];
      if (!isEmail(email) || !allowedRoles.includes(role)) {
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Admin user invalido.",
        });
      }
      const created = await store.update((database) => {
        const exists = database.adminUsers.some(
          (item) => item.email.toLowerCase() === email,
        );
        if (exists)
          throw new ApiError({
            status: 409,
            code: "ADMIN_USER_EXISTS",
            message: "Admin user ya existe.",
          });
        const timestamp = now();
        const item = {
          id: id("admin_user"),
          name,
          email,
          passwordHash: hashPassword(
            readOptionalString(req.body?.password) ?? "changeme",
          ),
          role,
          status: "invited" as const,
          requires2fa: req.body?.requires2fa !== false,
          twoFactorEnabled: false,
          lastLoginAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        database.adminUsers.push(item);
        return item;
      });
      await store.adminAudit({
        adminUserId: adminUser.id,
        action: "super_admin.admin_user.created",
        targetType: "admin_user",
        targetId: created.id,
        workspaceId: null,
        reason: readOptionalString(req.body?.reason) ?? null,
        metadata: { role: created.role },
        ip: req.ip ?? null,
        userAgent: req.header("user-agent") ?? null,
      });
      ok(res, publicAdminUser(created), 201);
    }),
  );

  router.post(
    "/auth/login",
    rateLimit({
      key: (req) => `login:${req.ip}:${String(req.body?.email ?? "")}`,
      limit: 5,
      windowMs: 60_000,
    }),
    asyncHandler(async (req, res) => {
      const email = requireString(req.body?.email, "email").toLowerCase();
      const password = requireString(req.body?.password, "password");
      const result = await store.update((database) => {
        const user = database.users.find(
          (item) => item.email.toLowerCase() === email,
        );
        if (!user || !verifyPassword(password, user.passwordHash)) {
          throw new ApiError({
            status: 401,
            code: "INVALID_CREDENTIALS",
            message: "Email o contraseña incorrectos.",
          });
        }
        if (user.status === "disabled") {
          throw new ApiError({
            status: 403,
            code: "USER_DISABLED",
            message: "Usuario deshabilitado.",
          });
        }
        const tokens = createTokens(user.id);
        const expiresAt = new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 30,
        ).toISOString();
        database.refreshTokens.push({
          id: id("refresh"),
          userId: user.id,
          tokenHash: hashToken(tokens.refreshToken, config.refreshSecret),
          expiresAt,
          revokedAt: null,
          createdAt: now(),
        });
        user.lastLoginAt = now();
        user.updatedAt = now();
        const memberships = database.memberships.filter(
          (item) => item.userId === user.id && item.status === "active",
        );
        const workspaces = memberships
          .map((membership) => {
            const found = database.workspaces.find(
              (item) => item.id === membership.workspaceId,
            );
            return found ? workspaceWithRole(found, membership.role) : null;
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
        return {
          user,
          tokens,
          workspaces,
          defaultWorkspaceId: workspaces[0]?.id ?? null,
        };
      });
      await store.audit({
        workspaceId: result.defaultWorkspaceId,
        userId: result.user.id,
        action: "auth.login",
        entityType: "user",
        entityId: result.user.id,
        metadata: null,
      });
      ok(res, {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        user: publicUser(result.user),
        workspaces: result.workspaces,
        defaultWorkspaceId: result.defaultWorkspaceId,
      });
    }),
  );

  router.post(
    "/auth/refresh",
    asyncHandler(async (req, res) => {
      const refreshToken = requireString(
        req.body?.refreshToken,
        "refreshToken",
      );
      const tokenHash = hashToken(refreshToken, config.refreshSecret);
      const result = await store.update((database) => {
        const stored = database.refreshTokens.find(
          (item) => item.tokenHash === tokenHash && !item.revokedAt,
        );
        if (!stored || stored.expiresAt < now()) {
          throw new ApiError({
            status: 401,
            code: "UNAUTHORIZED",
            message: "Refresh token invalido.",
          });
        }
        stored.revokedAt = now();
        const user = database.users.find((item) => item.id === stored.userId);
        if (!user || user.status !== "active") {
          throw new ApiError({
            status: 401,
            code: "UNAUTHORIZED",
            message: "No autenticado.",
          });
        }
        const tokens = createTokens(user.id);
        database.refreshTokens.push({
          id: id("refresh"),
          userId: user.id,
          tokenHash: hashToken(tokens.refreshToken, config.refreshSecret),
          expiresAt: new Date(
            Date.now() + 1000 * 60 * 60 * 24 * 30,
          ).toISOString(),
          revokedAt: null,
          createdAt: now(),
        });
        return tokens;
      });
      ok(res, result);
    }),
  );

  router.post(
    "/auth/logout",
    auth,
    asyncHandler(async (req, res) => {
      const refreshToken = readOptionalString(req.body?.refreshToken);
      if (refreshToken) {
        const tokenHash = hashToken(refreshToken, config.refreshSecret);
        await store.update((database) => {
          const stored = database.refreshTokens.find(
            (item) => item.tokenHash === tokenHash,
          );
          if (stored) stored.revokedAt = now();
        });
      }
      await store.audit({
        workspaceId: null,
        userId: req.auth?.user.id ?? null,
        action: "auth.logout",
        entityType: "user",
        entityId: req.auth?.user.id ?? null,
        metadata: null,
      });
      empty(res);
    }),
  );

  router.get(
    "/auth/me",
    auth,
    asyncHandler(async (req, res) => {
      if (!req.auth)
        throw new ApiError({
          status: 401,
          code: "UNAUTHORIZED",
          message: "No autenticado.",
        });
      const database = await store.read();
      const memberships = database.memberships.filter(
        (item) => item.userId === req.auth?.user.id && item.status === "active",
      );
      const workspaces = memberships
        .map((membership) => {
          const found = database.workspaces.find(
            (item) => item.id === membership.workspaceId,
          );
          return found ? workspaceWithRole(found, membership.role) : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      const requestedWorkspaceId = req.header("X-Workspace-Id");
      const currentWorkspace =
        workspaces.find((item) => item.id === requestedWorkspaceId) ??
        workspaces[0] ??
        null;
      ok(res, {
        user: publicUser(req.auth.user),
        currentWorkspace,
        workspaces,
      });
    }),
  );

  router.post("/auth/forgot-password", (_req, res) => {
    ok(res, {
      message:
        "Si el correo existe, enviaremos instrucciones para restablecer la contraseña.",
    });
  });

  router.post(
    "/auth/reset-password",
    asyncHandler(async (req, res) => {
      requireString(req.body?.token, "token");
      const password = requireString(req.body?.password, "password");
      const confirmation = requireString(
        req.body?.passwordConfirmation,
        "passwordConfirmation",
      );
      if (password.length < 8 || password !== confirmation) {
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message:
            "La contraseña debe tener al menos 8 caracteres y coincidir.",
        });
      }
      ok(res, { message: "Contraseña actualizada correctamente." });
    }),
  );

  router.use(auth);

  router.get(
    "/workspaces",
    asyncHandler(async (req, res) => {
      if (!req.auth)
        throw new ApiError({
          status: 401,
          code: "UNAUTHORIZED",
          message: "No autenticado.",
        });
      const database = await store.read();
      const data = database.memberships
        .filter(
          (item) =>
            item.userId === req.auth?.user.id && item.status === "active",
        )
        .map((membership) => {
          const found = database.workspaces.find(
            (item) => item.id === membership.workspaceId,
          );
          return found ? workspaceWithRole(found, membership.role) : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      ok(res, data);
    }),
  );

  router.use(workspace);

  router.get("/workspaces/current", (req, res) => {
    const context = assertWorkspace(req);
    ok(res, context.workspace);
  });

  router.patch(
    "/workspaces/current",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const data = await store.update((database) => {
        const workspace = database.workspaces.find(
          (item) => item.id === context.workspace.id,
        );
        if (!workspace)
          throw new ApiError({
            status: 404,
            code: "WORKSPACE_NOT_FOUND",
            message: "Workspace no encontrado.",
          });
        const name = readOptionalString(req.body?.name);
        const slug = readOptionalString(req.body?.slug);
        const timezone = readOptionalString(req.body?.timezone);
        if (slug && !slugValid(slug)) {
          throw new ApiError({
            status: 400,
            code: "VALIDATION_ERROR",
            message: "Slug invalido.",
          });
        }
        if (
          slug &&
          database.workspaces.some(
            (item) => item.slug === slug && item.id !== workspace.id,
          )
        ) {
          throw new ApiError({
            status: 409,
            code: "SLUG_ALREADY_EXISTS",
            message: "El slug ya existe.",
          });
        }
        if (name) workspace.name = name;
        if (slug) workspace.slug = slug;
        if (timezone) workspace.timezone = timezone;
        workspace.updatedAt = now();
        return workspace;
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "workspace.updated",
        entityType: "workspace",
        entityId: data.id,
        metadata: null,
      });
      ok(res, data);
    }),
  );

  router.get(
    "/users",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const rows = database.memberships
        .filter((item) => item.workspaceId === context.workspace.id)
        .filter((item) =>
          req.query.role ? item.role === req.query.role : true,
        )
        .filter((item) =>
          req.query.status ? item.status === req.query.status : true,
        )
        .map((membership) => {
          const user = database.users.find(
            (item) => item.id === membership.userId,
          );
          return user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                status: membership.status,
                role: membership.role,
                lastLoginAt: user.lastLoginAt,
                createdAt: user.createdAt,
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter((user) => {
          const search = readOptionalString(req.query.search);
          return search
            ? `${user.name} ${user.email}`
                .toLowerCase()
                .includes(search.toLowerCase())
            : true;
        });
      const page = pageResponse(rows, req.query);
      paginated(res, page.items, { ...page.pagination, total: page.total });
    }),
  );

  router.post(
    "/users/invitations",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const name = requireString(req.body?.name, "name");
      const email = requireString(req.body?.email, "email").toLowerCase();
      const role = requireString(req.body?.role, "role");
      if (!isEmail(email) || !roleValid(role) || role === "owner") {
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Email o rol invalido.",
        });
      }
      const data = await store.update((database) => {
        const existingUser = database.users.find(
          (user) => user.email.toLowerCase() === email,
        );
        if (existingUser) {
          const existingMembership = database.memberships.find(
            (item) =>
              item.userId === existingUser.id &&
              item.workspaceId === context.workspace.id,
          );
          if (existingMembership) {
            throw new ApiError({
              status: 409,
              code: "USER_ALREADY_EXISTS",
              message: "El usuario ya pertenece al workspace.",
            });
          }
        }
        const user = existingUser ?? {
          id: id("user"),
          name,
          email,
          passwordHash: hashPassword(randomUUID()),
          status: "invited" as const,
          lastLoginAt: null,
          createdAt: now(),
          updatedAt: now(),
        };
        if (!existingUser) database.users.push(user);
        const membership = {
          id: id("membership"),
          workspaceId: context.workspace.id,
          userId: user.id,
          role,
          status: "invited" as const,
          invitationSentAt: now(),
          createdAt: now(),
          updatedAt: now(),
        };
        database.memberships.push(membership);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role,
          status: membership.status,
          invitationSentAt: membership.invitationSentAt,
        };
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "user.invited",
        entityType: "user",
        entityId: data.id,
        metadata: { role },
      });
      ok(res, data, 201);
    }),
  );

  router.get(
    "/users/:id",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const membership = database.memberships.find(
        (item) =>
          item.workspaceId === context.workspace.id &&
          item.userId === req.params.id,
      );
      const user = database.users.find((item) => item.id === req.params.id);
      if (!membership || !user)
        throw new ApiError({
          status: 404,
          code: "USER_NOT_FOUND",
          message: "Usuario no encontrado.",
        });
      ok(res, {
        ...publicUser(user),
        role: membership.role,
        status: membership.status,
      });
    }),
  );

  router.patch(
    "/users/:id",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const data = await store.update((database) => {
        const membership = database.memberships.find(
          (item) =>
            item.workspaceId === context.workspace.id &&
            item.userId === req.params.id,
        );
        const user = database.users.find((item) => item.id === req.params.id);
        if (!membership || !user)
          throw new ApiError({
            status: 404,
            code: "USER_NOT_FOUND",
            message: "Usuario no encontrado.",
          });
        if (context.role === "admin" && membership.role === "owner") {
          throw new ApiError({
            status: 403,
            code: "INSUFFICIENT_ROLE",
            message: "Admin no puede editar owner.",
          });
        }
        const name = readOptionalString(req.body?.name);
        const role = readOptionalString(req.body?.role);
        const status = readOptionalString(req.body?.status);
        if (
          role &&
          (!roleValid(role) || (context.role === "admin" && role === "owner"))
        ) {
          throw new ApiError({
            status: 400,
            code: "INVALID_ROLE",
            message: "Rol invalido.",
          });
        }
        if (status && !["active", "disabled", "invited"].includes(status)) {
          throw new ApiError({
            status: 400,
            code: "INVALID_STATUS",
            message: "Estado invalido.",
          });
        }
        if (status === "disabled" || role) {
          const activeOwners = database.memberships.filter(
            (item) =>
              item.workspaceId === context.workspace.id &&
              item.role === "owner" &&
              item.status === "active",
          );
          if (
            membership.role === "owner" &&
            activeOwners.length <= 1 &&
            (status === "disabled" || role !== "owner")
          ) {
            throw new ApiError({
              status: 409,
              code: "LAST_OWNER_CANNOT_BE_REMOVED",
              message: "No se puede remover al ultimo owner.",
            });
          }
        }
        if (name) user.name = name;
        if (role && roleValid(role)) membership.role = role;
        if (
          status === "active" ||
          status === "disabled" ||
          status === "invited"
        )
          membership.status = status;
        user.updatedAt = now();
        membership.updatedAt = now();
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: membership.role,
          status: membership.status,
          updatedAt: user.updatedAt,
        };
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "user.updated",
        entityType: "user",
        entityId: data.id,
        metadata: null,
      });
      realtime.emitToWorkspace(context.workspace.id, "user.updated", data);
      ok(res, data);
    }),
  );

  router.post(
    "/users/:id/resend-invitation",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      await store.update((database) => {
        const membership = database.memberships.find(
          (item) =>
            item.workspaceId === context.workspace.id &&
            item.userId === req.params.id,
        );
        if (!membership)
          throw new ApiError({
            status: 404,
            code: "USER_NOT_FOUND",
            message: "Usuario no encontrado.",
          });
        membership.invitationSentAt = now();
        membership.updatedAt = now();
      });
      ok(res, { message: "Invitación reenviada correctamente." });
    }),
  );

  router.post(
    "/users/:id/disable",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      req.body = { ...req.body, status: "disabled" };
      const context = assertWorkspace(req);
      await store.update((database) => {
        const membership = database.memberships.find(
          (item) =>
            item.workspaceId === context.workspace.id &&
            item.userId === req.params.id,
        );
        if (!membership)
          throw new ApiError({
            status: 404,
            code: "USER_NOT_FOUND",
            message: "Usuario no encontrado.",
          });
        const activeOwners = database.memberships.filter(
          (item) =>
            item.workspaceId === context.workspace.id &&
            item.role === "owner" &&
            item.status === "active",
        );
        if (membership.role === "owner" && activeOwners.length <= 1)
          throw new ApiError({
            status: 409,
            code: "LAST_OWNER_CANNOT_BE_REMOVED",
            message: "No se puede deshabilitar al ultimo owner.",
          });
        membership.status = "disabled";
        membership.updatedAt = now();
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "user.disabled",
        entityType: "user",
        entityId: req.params.id,
        metadata: null,
      });
      ok(res, { id: req.params.id, status: "disabled" });
    }),
  );

  router.post(
    "/users/:id/enable",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      await store.update((database) => {
        const membership = database.memberships.find(
          (item) =>
            item.workspaceId === context.workspace.id &&
            item.userId === req.params.id,
        );
        if (!membership)
          throw new ApiError({
            status: 404,
            code: "USER_NOT_FOUND",
            message: "Usuario no encontrado.",
          });
        membership.status = "active";
        membership.updatedAt = now();
      });
      ok(res, { id: req.params.id, status: "active" });
    }),
  );

  router.get(
    "/whatsapp-accounts",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const rows = database.whatsappAccounts
        .filter((item) => item.workspaceId === context.workspace.id)
        .filter((item) =>
          req.query.status ? item.status === req.query.status : true,
        )
        .filter((item) => {
          const search = readOptionalString(req.query.search);
          return search
            ? `${item.displayName} ${item.phoneNumber ?? ""}`
                .toLowerCase()
                .includes(search.toLowerCase())
            : true;
        })
        .map((item) => whatsappAccountView(item, database));
      const page = pageResponse(rows, req.query);
      paginated(res, page.items, { ...page.pagination, total: page.total });
    }),
  );

  router.post(
    "/whatsapp-accounts",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const displayName = requireString(req.body?.displayName, "displayName");
      if (displayName.length > 80)
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Nombre maximo 80 caracteres.",
        });
      const created = await store.update((database) => {
        if (
          database.whatsappAccounts.some(
            (item) =>
              item.workspaceId === context.workspace.id &&
              item.displayName.toLowerCase() === displayName.toLowerCase(),
          )
        ) {
          throw new ApiError({
            status: 409,
            code: "CONFLICT",
            message: "Ya existe un numero con ese nombre.",
          });
        }
        const account = {
          id: id("wa_account"),
          workspaceId: context.workspace.id,
          externalInstanceId: `wa_${context.workspace.id.slice(0, 8)}_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
          phoneNumber: null,
          displayName,
          description: readOptionalString(req.body?.description) ?? null,
          timezone:
            readOptionalString(req.body?.timezone) ??
            context.workspace.timezone,
          status: "pending" as WhatsAppStatus,
          qrCode: null,
          enabled: true,
          useWorkspaceBusinessHours:
            req.body?.useWorkspaceBusinessHours !== false,
          useWorkspaceBotSettings: req.body?.useWorkspaceBotSettings !== false,
          lastConnectedAt: null,
          lastDisconnectedAt: null,
          createdAt: now(),
          updatedAt: now(),
        };
        database.whatsappAccounts.push(account);
        return account;
      });
      await whatsappClient.createConnection({
        connectionId: created.externalInstanceId,
        businessId: context.workspace.id,
        label: created.displayName,
        autoStart: false,
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "whatsapp_account.created",
        entityType: "whatsapp_account",
        entityId: created.id,
        metadata: null,
      });
      ok(res, { ...whatsappAccountView(created), qrAvailable: false }, 201);
    }),
  );

  router.get(
    "/whatsapp-accounts/:id",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const account = findAccount(
        database,
        context.workspace.id,
        req.params.id,
      );
      const recentConversations = database.conversations
        .filter(
          (conversation) =>
            conversation.whatsappAccountId === account.id &&
            conversation.workspaceId === context.workspace.id,
        )
        .sort((left, right) =>
          (right.lastMessageAt ?? "").localeCompare(left.lastMessageAt ?? ""),
        )
        .slice(0, 5)
        .map((conversation) => {
          const contact = database.contacts.find(
            (item) => item.id === conversation.contactId,
          );
          return {
            id: conversation.id,
            contactName: contact?.name ?? contact?.phoneNumber ?? "Contacto",
            lastMessageBody: conversation.lastMessageBody,
            lastMessageAt: conversation.lastMessageAt,
          };
        });
      ok(res, {
        ...whatsappAccountView(account, database),
        recentConversations,
      });
    }),
  );

  router.patch(
    "/whatsapp-accounts/:id",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const updated = await store.update((database) => {
        const account = findAccount(
          database,
          context.workspace.id,
          req.params.id,
        );
        const displayName = readOptionalString(req.body?.displayName);
        if (displayName) account.displayName = displayName;
        if ("description" in req.body)
          account.description =
            readOptionalString(req.body?.description) ?? null;
        if (typeof req.body?.enabled === "boolean")
          account.enabled = req.body.enabled;
        if (readOptionalString(req.body?.timezone))
          account.timezone = readOptionalString(req.body?.timezone)!;
        if (typeof req.body?.useWorkspaceBusinessHours === "boolean")
          account.useWorkspaceBusinessHours =
            req.body.useWorkspaceBusinessHours;
        if (typeof req.body?.useWorkspaceBotSettings === "boolean")
          account.useWorkspaceBotSettings = req.body.useWorkspaceBotSettings;
        account.updatedAt = now();
        return account;
      });
      ok(res, whatsappAccountView(updated));
    }),
  );

  async function qrForAccount(
    accountId: string,
    context: ReturnType<typeof assertWorkspace>,
  ) {
    const externalQr = await (async () => {
      const database = await store.read();
      const account = findAccount(database, context.workspace.id, accountId);
      try {
        return await whatsappClient.getConnectionQr(account.externalInstanceId);
      } catch {
        return {
          payload: `mock_qr_${account.externalInstanceId}`,
          imageUrl: `data:text/plain;base64,${Buffer.from(`QR ${account.externalInstanceId}`).toString("base64")}`,
          expiresAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
        };
      }
    })();

    return store.update((database) => {
      const account = findAccount(database, context.workspace.id, accountId);
      account.status = "qr_required";
      account.qrCode =
        externalQr.qr ??
        externalQr.qrImage ??
        externalQr.payload ??
        externalQr.imageBase64 ??
        externalQr.imageUrl ??
        null;
      account.updatedAt = now();
      return {
        id: account.id,
        status: account.status,
        qr: {
          payload: externalQr.qr ?? externalQr.payload ?? account.qrCode,
          imageUrl:
            externalQr.qrImage ??
            externalQr.imageUrl ??
            (externalQr.imageBase64
              ? `data:image/png;base64,${externalQr.imageBase64}`
              : null),
          expiresAt:
            externalQr.expiresAt ??
            new Date(Date.now() + 1000 * 60 * 5).toISOString(),
        },
      };
    });
  }

  router.post(
    "/whatsapp-accounts/:id/connect",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const snapshot = await store.read();
      const account = findAccount(
        snapshot,
        context.workspace.id,
        req.params.id,
      );
      await whatsappClient.startConnection(account.externalInstanceId);
      await whatsappClient.createWebhookSubscription(
        `${config.publicBaseUrl.replace(/\/+$/, "")}/webhooks/whatsapp`,
        ["connection.*", "message.*"],
        config.takuWaWebhookSecret,
      );
      const data = await qrForAccount(req.params.id, context);
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "whatsapp_account.qr_requested",
        entityType: "whatsapp_account",
        entityId: req.params.id,
        metadata: null,
      });
      realtime.emitToWorkspace(
        context.workspace.id,
        "whatsapp.qr.updated",
        data,
      );
      ok(res, data);
    }),
  );

  router.get(
    "/whatsapp-accounts/:id/qr",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      ok(res, await qrForAccount(req.params.id, context));
    }),
  );

  router.post(
    "/whatsapp-accounts/:id/qr/regenerate",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      ok(res, await qrForAccount(req.params.id, context));
    }),
  );

  router.post(
    "/whatsapp-accounts/:id/disconnect",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const snapshot = await store.read();
      const externalInstanceId = findAccount(
        snapshot,
        context.workspace.id,
        req.params.id,
      ).externalInstanceId;
      await whatsappClient.stopConnection(externalInstanceId);
      const data = await store.update((database) => {
        const account = findAccount(
          database,
          context.workspace.id,
          req.params.id,
        );
        account.status = "disconnected";
        account.lastDisconnectedAt = now();
        account.updatedAt = now();
        return {
          id: account.id,
          status: account.status,
          lastDisconnectedAt: account.lastDisconnectedAt,
        };
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "whatsapp_account.disconnected",
        entityType: "whatsapp_account",
        entityId: req.params.id,
        metadata: { reason: req.body?.reason ?? null },
      });
      realtime.emitToWorkspace(
        context.workspace.id,
        "whatsapp.status.updated",
        { whatsappAccountId: req.params.id, status: "disconnected" },
      );
      ok(res, data);
    }),
  );

  router.post(
    "/whatsapp-accounts/:id/sync",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const data = await store.update((database) => {
        const account = findAccount(
          database,
          context.workspace.id,
          req.params.id,
        );
        account.status =
          account.status === "disabled" ? "disabled" : account.status;
        account.updatedAt = now();
        return {
          id: account.id,
          status: account.status,
          phoneNumber: account.phoneNumber,
          lastConnectedAt: account.lastConnectedAt,
        };
      });
      ok(res, data);
    }),
  );

  router.delete(
    "/whatsapp-accounts/:id",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const data = await store.update((database) => {
        const account = findAccount(
          database,
          context.workspace.id,
          req.params.id,
        );
        account.status = "disabled";
        account.enabled = false;
        account.updatedAt = now();
        return { id: account.id, status: account.status };
      });
      ok(res, data);
    }),
  );

  router.get(
    "/contacts",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const search = readOptionalString(req.query.search)?.toLowerCase();
      const phone = readOptionalString(req.query.phone);
      const rows = database.contacts
        .filter((item) => item.workspaceId === context.workspace.id)
        .filter((item) => (phone ? item.phoneNumber.includes(phone) : true))
        .filter((item) =>
          search
            ? `${item.name ?? ""} ${item.phoneNumber}`
                .toLowerCase()
                .includes(search)
            : true,
        )
        .map((item) => contactView(item, database));
      const page = pageResponse(rows, req.query);
      paginated(res, page.items, { ...page.pagination, total: page.total });
    }),
  );

  router.get(
    "/contacts/:id",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const contact = database.contacts.find(
        (item) =>
          item.id === req.params.id &&
          item.workspaceId === context.workspace.id,
      );
      if (!contact)
        throw new ApiError({
          status: 404,
          code: "CONTACT_NOT_FOUND",
          message: "Contacto no encontrado.",
        });
      ok(res, contactView(contact));
    }),
  );

  router.patch(
    "/contacts/:id",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const data = await store.update((database) => {
        const contact = database.contacts.find(
          (item) =>
            item.id === req.params.id &&
            item.workspaceId === context.workspace.id,
        );
        if (!contact)
          throw new ApiError({
            status: 404,
            code: "CONTACT_NOT_FOUND",
            message: "Contacto no encontrado.",
          });
        const name = readOptionalString(req.body?.name);
        const notes =
          typeof req.body?.notes === "string" ? req.body.notes : undefined;
        if (name && name.length > 120)
          throw new ApiError({
            status: 400,
            code: "VALIDATION_ERROR",
            message: "Nombre maximo 120 caracteres.",
          });
        if (notes && notes.length > 2000)
          throw new ApiError({
            status: 400,
            code: "VALIDATION_ERROR",
            message: "Notas maximo 2000 caracteres.",
          });
        if ("name" in req.body) contact.name = name ?? null;
        if ("notes" in req.body) contact.notes = notes ?? null;
        contact.updatedAt = now();
        return contactView(contact);
      });
      ok(res, data);
    }),
  );

  router.get(
    "/conversations",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const search = readOptionalString(req.query.search)?.toLowerCase();
      const rows = database.conversations
        .filter((item) => item.workspaceId === context.workspace.id)
        .filter((item) =>
          req.query.status ? item.status === req.query.status : true,
        )
        .filter((item) =>
          req.query.whatsappAccountId
            ? item.whatsappAccountId === req.query.whatsappAccountId
            : true,
        )
        .filter((item) => {
          if (req.query.assignedTo === "me")
            return item.assignedUserId === context.user.id;
          if (req.query.assignedTo === "unassigned")
            return item.assignedUserId === null;
          if (typeof req.query.assignedTo === "string")
            return item.assignedUserId === req.query.assignedTo;
          return true;
        })
        .filter((item) =>
          req.query.unread === "true" ? item.unreadCount > 0 : true,
        )
        .map((item) => conversationView(item, database))
        .filter((item) => {
          if (!search) return true;
          return `${item.contact?.name ?? ""} ${item.contact?.phoneNumber ?? ""} ${item.lastMessage?.body ?? ""}`
            .toLowerCase()
            .includes(search);
        })
        .sort((left, right) =>
          (right.lastMessageAt ?? "").localeCompare(left.lastMessageAt ?? ""),
        );
      const page = pageResponse(rows, req.query);
      paginated(res, page.items, { ...page.pagination, total: page.total });
    }),
  );

  router.get(
    "/conversations/:id",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      ok(
        res,
        conversationView(
          findConversation(database, context.workspace.id, req.params.id),
          database,
        ),
      );
    }),
  );

  router.patch(
    "/conversations/:id/status",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const status = requireString(req.body?.status, "status");
      if (!statusValid(status))
        throw new ApiError({
          status: 400,
          code: "INVALID_STATUS",
          message: "Estado invalido.",
        });
      const data = await store.update((database) => {
        const conversation = findConversation(
          database,
          context.workspace.id,
          req.params.id,
        );
        conversation.status = status;
        conversation.updatedAt = now();
        database.messages.push({
          id: id("message"),
          workspaceId: context.workspace.id,
          conversationId: conversation.id,
          whatsappAccountId: conversation.whatsappAccountId,
          contactId: conversation.contactId,
          externalMessageId: null,
          direction: "system",
          type: "text",
          body: `Conversacion actualizada a ${status}.`,
          mediaUrl: null,
          mediaMimeType: null,
          mediaFilename: null,
          status: "created",
          sentByUserId: context.user.id,
          createdAt: now(),
          updatedAt: now(),
        });
        return {
          id: conversation.id,
          status: conversation.status,
          updatedAt: conversation.updatedAt,
        };
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "conversation.status_updated",
        entityType: "conversation",
        entityId: req.params.id,
        metadata: { status },
      });
      realtime.emitToWorkspace(
        context.workspace.id,
        "conversation.updated",
        data,
      );
      ok(res, data);
    }),
  );

  router.patch(
    "/conversations/:id/assignment",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      if (context.role === "agent") {
        const database = await store.read();
        const preferences = database.preferences.find(
          (item) => item.workspaceId === context.workspace.id,
        );
        if (!preferences?.agentsCanReassignConversations) {
          throw new ApiError({
            status: 403,
            code: "FORBIDDEN",
            message: "No tienes permiso para reasignar.",
          });
        }
      }
      const assignedUserId =
        typeof req.body?.assignedUserId === "string"
          ? req.body.assignedUserId
          : null;
      const data = await store.update((database) => {
        const conversation = findConversation(
          database,
          context.workspace.id,
          req.params.id,
        );
        if (assignedUserId) {
          const membership = database.memberships.find(
            (item) =>
              item.workspaceId === context.workspace.id &&
              item.userId === assignedUserId &&
              item.status === "active",
          );
          if (!membership)
            throw new ApiError({
              status: 400,
              code: "VALIDATION_ERROR",
              message: "El agente debe pertenecer al workspace.",
            });
        }
        conversation.assignedUserId = assignedUserId;
        conversation.updatedAt = now();
        const assignedUser = assignedUserId
          ? database.users.find((item) => item.id === assignedUserId)
          : null;
        return {
          id: conversation.id,
          assignedUser: assignedUser
            ? { id: assignedUser.id, name: assignedUser.name }
            : null,
          updatedAt: conversation.updatedAt,
        };
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "conversation.assigned",
        entityType: "conversation",
        entityId: req.params.id,
        metadata: { assignedUserId },
      });
      realtime.emitToWorkspace(
        context.workspace.id,
        "conversation.updated",
        data,
      );
      ok(res, data);
    }),
  );

  router.post(
    "/conversations/:id/read",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const data = await store.update((database) => {
        const conversation = findConversation(
          database,
          context.workspace.id,
          req.params.id,
        );
        conversation.unreadCount = 0;
        conversation.updatedAt = now();
        return { id: conversation.id, unreadCount: conversation.unreadCount };
      });
      ok(res, data);
    }),
  );

  router.get(
    "/conversations/:conversationId/messages",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const conversation = findConversation(
        database,
        context.workspace.id,
        req.params.conversationId,
      );
      const rows = database.messages
        .filter(
          (item) =>
            item.conversationId === conversation.id &&
            item.workspaceId === context.workspace.id,
        )
        .filter((item) =>
          req.query.before ? item.createdAt < String(req.query.before) : true,
        )
        .filter((item) =>
          req.query.after ? item.createdAt > String(req.query.after) : true,
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map((item) => messageView(item, database));
      const page = pageResponse(rows, {
        ...req.query,
        pageSize: req.query.pageSize ?? 50,
      });
      paginated(res, page.items, { ...page.pagination, total: page.total });
    }),
  );

  router.post(
    "/conversations/:conversationId/messages",
    rateLimit({
      key: (req) => `messages:${req.workspaceContext?.workspace.id ?? req.ip}`,
      limit: 60,
      windowMs: 60_000,
    }),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const type = (readOptionalString(req.body?.type) ??
        "text") as MessageType;
      const body = requireString(req.body?.body, "body");
      if (type === "text" && !body.trim())
        throw new ApiError({
          status: 400,
          code: "EMPTY_MESSAGE",
          message: "No se permite mensaje vacio.",
        });
      const snapshot = await store.read();
      const snapshotConversation = findConversation(
        snapshot,
        context.workspace.id,
        req.params.conversationId,
      );
      const snapshotAccount = findAccount(
        snapshot,
        context.workspace.id,
        snapshotConversation.whatsappAccountId,
      );
      if (snapshotAccount.status !== "connected") {
        throw new ApiError({
          status: 409,
          code: "WHATSAPP_ACCOUNT_DISCONNECTED",
          message: "El numero esta desconectado.",
        });
      }
      const snapshotContact = snapshot.contacts.find(
        (item) => item.id === snapshotConversation.contactId,
      );
      if (!snapshotContact)
        throw new ApiError({
          status: 404,
          code: "CONTACT_NOT_FOUND",
          message: "Contacto no encontrado.",
        });

      let externalMessageId: string | null = null;
      let status: Message["status"] = "queued";
      try {
        const external = await whatsappClient.sendTextMessage(
          snapshotAccount.externalInstanceId,
          snapshotContact.phoneNumber,
          body,
        );
        externalMessageId = external.messageId ?? null;
        status = external.status === "failed" ? "failed" : "sent";
      } catch {
        status = "failed";
      }

      const result = await store.update((database) => {
        const conversation = findConversation(
          database,
          context.workspace.id,
          req.params.conversationId,
        );
        const account = findAccount(
          database,
          context.workspace.id,
          conversation.whatsappAccountId,
        );
        if (account.status !== "connected") {
          throw new ApiError({
            status: 409,
            code: "WHATSAPP_ACCOUNT_DISCONNECTED",
            message: "El numero esta desconectado.",
          });
        }
        const contact = database.contacts.find(
          (item) => item.id === conversation.contactId,
        );
        if (!contact)
          throw new ApiError({
            status: 404,
            code: "CONTACT_NOT_FOUND",
            message: "Contacto no encontrado.",
          });
        const message: Message = {
          id: id("message"),
          workspaceId: context.workspace.id,
          conversationId: conversation.id,
          whatsappAccountId: account.id,
          contactId: contact.id,
          externalMessageId,
          direction: "outbound",
          type,
          body,
          mediaUrl: null,
          mediaMimeType: null,
          mediaFilename: null,
          status,
          sentByUserId: context.user.id,
          createdAt: now(),
          updatedAt: now(),
        };
        database.messages.push(message);
        conversation.lastMessageBody = body;
        conversation.lastMessageAt = message.createdAt;
        conversation.updatedAt = now();
        return { message: messageView(message, database), conversation };
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "message.sent",
        entityType: "conversation",
        entityId: req.params.conversationId,
        metadata: null,
      });
      realtime.emitToWorkspace(context.workspace.id, "message.created", {
        conversationId: req.params.conversationId,
        message: result.message,
      });
      realtime.emitToWorkspace(
        context.workspace.id,
        "conversation.updated",
        conversationView(result.conversation, await store.read()),
      );
      ok(res, result.message, 201);
    }),
  );

  router.post(
    "/conversations/:conversationId/messages/attachments",
    asyncHandler(async (_req, res) => {
      ok(
        res,
        {
          message:
            "Endpoint preparado para MVP futuro; media depende de WhatsApp Service.",
        },
        201,
      );
    }),
  );

  router.post(
    "/messages/:id/retry",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const data = await store.update((database) => {
        const message = database.messages.find(
          (item) =>
            item.id === req.params.id &&
            item.workspaceId === context.workspace.id,
        );
        if (!message)
          throw new ApiError({
            status: 404,
            code: "MESSAGE_NOT_FOUND",
            message: "Mensaje no encontrado.",
          });
        message.status = "queued";
        message.updatedAt = now();
        return { id: message.id, status: message.status };
      });
      ok(res, data);
    }),
  );

  router.get(
    "/business-hours",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const whatsappAccountId =
        readOptionalString(req.query.whatsappAccountId) ?? null;
      const days = database.businessHours
        .filter(
          (item) =>
            item.workspaceId === context.workspace.id &&
            item.whatsappAccountId === whatsappAccountId,
        )
        .sort((left, right) => left.dayOfWeek - right.dayOfWeek);
      ok(res, {
        scope: whatsappAccountId ? "whatsapp_account" : "workspace",
        whatsappAccountId,
        timezone: context.workspace.timezone,
        currentStatus: {
          isOpen: true,
          label: "Abierto ahora",
          nextChangeAt: new Date().toISOString(),
        },
        days,
      });
    }),
  );

  router.put(
    "/business-hours",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const whatsappAccountId =
        readOptionalString(req.body?.whatsappAccountId) ?? null;
      const days = Array.isArray(req.body?.days) ? req.body.days : [];
      if (!days.length)
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "days requerido.",
        });
      await store.update((database) => {
        if (whatsappAccountId)
          findAccount(database, context.workspace.id, whatsappAccountId);
        const seen = new Set<number>();
        for (const day of days) {
          const dayOfWeek = Number(day.dayOfWeek);
          if (
            !Number.isInteger(dayOfWeek) ||
            dayOfWeek < 0 ||
            dayOfWeek > 6 ||
            seen.has(dayOfWeek)
          ) {
            throw new ApiError({
              status: 400,
              code: "VALIDATION_ERROR",
              message: "Dia invalido o duplicado.",
            });
          }
          seen.add(dayOfWeek);
          if (
            !day.isClosed &&
            (!day.opensAt ||
              !day.closesAt ||
              String(day.closesAt) <= String(day.opensAt))
          ) {
            throw new ApiError({
              status: 400,
              code: "VALIDATION_ERROR",
              message: "Horario invalido.",
            });
          }
        }
        database.businessHours = database.businessHours.filter(
          (item) =>
            !(
              item.workspaceId === context.workspace.id &&
              item.whatsappAccountId === whatsappAccountId
            ),
        );
        for (const day of days) {
          database.businessHours.push({
            id: id("business_hour"),
            workspaceId: context.workspace.id,
            whatsappAccountId,
            dayOfWeek: Number(day.dayOfWeek),
            opensAt: day.isClosed ? null : String(day.opensAt),
            closesAt: day.isClosed ? null : String(day.closesAt),
            isClosed: Boolean(day.isClosed),
            createdAt: now(),
            updatedAt: now(),
          });
        }
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "business_hours.updated",
        entityType: "business_hours",
        entityId: null,
        metadata: { whatsappAccountId },
      });
      ok(res, { message: "Horario actualizado correctamente." });
    }),
  );

  router.get("/business-hours/status", requireRole(ownerAdmin), (req, res) => {
    const context = assertWorkspace(req);
    ok(res, {
      isOpen: true,
      label: "Abierto ahora",
      nextOpenAt: null,
      timezone: context.workspace.timezone,
    });
  });

  router.get(
    "/bot-settings",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const whatsappAccountId =
        readOptionalString(req.query.whatsappAccountId) ?? null;
      const settings = database.botSettings.find(
        (item) =>
          item.workspaceId === context.workspace.id &&
          item.whatsappAccountId === whatsappAccountId,
      );
      if (!settings)
        throw new ApiError({
          status: 404,
          code: "BOT_SETTINGS_NOT_FOUND",
          message: "Configuracion no encontrada.",
        });
      ok(res, {
        scope: whatsappAccountId ? "whatsapp_account" : "workspace",
        ...settings,
      });
    }),
  );

  router.patch(
    "/bot-settings",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const whatsappAccountId =
        readOptionalString(req.body?.whatsappAccountId) ?? null;
      const afterHoursEnabled = Boolean(req.body?.afterHoursEnabled);
      const afterHoursMessage =
        readOptionalString(req.body?.afterHoursMessage) ?? null;
      if (afterHoursEnabled && !afterHoursMessage)
        throw new ApiError({
          status: 400,
          code: "AFTER_HOURS_MESSAGE_REQUIRED",
          message: "Mensaje fuera de horario requerido.",
        });
      const settings = await store.update((database) => {
        if (whatsappAccountId)
          findAccount(database, context.workspace.id, whatsappAccountId);
        let item = database.botSettings.find(
          (setting) =>
            setting.workspaceId === context.workspace.id &&
            setting.whatsappAccountId === whatsappAccountId,
        );
        if (!item) {
          item = {
            id: id("bot_settings"),
            workspaceId: context.workspace.id,
            whatsappAccountId,
            enabled: false,
            afterHoursEnabled: false,
            afterHoursMessage: null,
            rulesEnabled: false,
            aiEnabled: false,
            externalBotId: null,
            createdAt: now(),
            updatedAt: now(),
          };
          database.botSettings.push(item);
        }
        if (typeof req.body?.enabled === "boolean")
          item.enabled = req.body.enabled;
        if (typeof req.body?.afterHoursEnabled === "boolean")
          item.afterHoursEnabled = req.body.afterHoursEnabled;
        if ("afterHoursMessage" in req.body)
          item.afterHoursMessage = afterHoursMessage;
        if (typeof req.body?.rulesEnabled === "boolean")
          item.rulesEnabled = req.body.rulesEnabled;
        if (typeof req.body?.aiEnabled === "boolean")
          item.aiEnabled = req.body.aiEnabled;
        item.updatedAt = now();
        return item;
      });
      void botClient.syncSettings(settings);
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "bot_settings.updated",
        entityType: "bot_settings",
        entityId: settings.id,
        metadata: null,
      });
      ok(res, settings);
    }),
  );

  router.post(
    "/bot-settings/test-after-hours",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      ok(res, {
        wouldRespond: true,
        reason: "Actualmente está fuera de horario.",
        responseText:
          "Gracias por escribir. Estamos fuera de horario. Te responderemos mañana a partir de las 9:00 AM.",
        workspaceId: context.workspace.id,
        whatsappAccountId: req.body?.whatsappAccountId ?? null,
        incomingText: req.body?.incomingText ?? "Hola",
      });
    }),
  );

  router.get(
    "/automation-rules",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const search = readOptionalString(req.query.search)?.toLowerCase();
      const rows = database.automationRules
        .filter((item) => item.workspaceId === context.workspace.id)
        .filter((item) =>
          req.query.enabled
            ? String(item.enabled) === String(req.query.enabled)
            : true,
        )
        .filter((item) =>
          req.query.whatsappAccountId
            ? item.whatsappAccountId === req.query.whatsappAccountId
            : true,
        )
        .filter((item) =>
          search
            ? `${item.keyword} ${item.responseText}`
                .toLowerCase()
                .includes(search)
            : true,
        )
        .map((item) => ({
          ...item,
          scope: item.whatsappAccountId ? "whatsapp_account" : "workspace",
          whatsappAccount: item.whatsappAccountId
            ? (database.whatsappAccounts.find(
                (account) => account.id === item.whatsappAccountId,
              ) ?? null)
            : null,
        }));
      const page = pageResponse(rows, req.query);
      paginated(res, page.items, { ...page.pagination, total: page.total });
    }),
  );

  router.post(
    "/automation-rules",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const keyword = requireString(req.body?.keyword, "keyword");
      const matchType = requireString(req.body?.matchType, "matchType");
      const responseText = requireString(
        req.body?.responseText,
        "responseText",
      );
      if (
        keyword.length > 80 ||
        responseText.length > 1000 ||
        !matchTypeValid(matchType)
      ) {
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Regla invalida.",
        });
      }
      const whatsappAccountId =
        readOptionalString(req.body?.whatsappAccountId) ?? null;
      const rule = await store.update((database) => {
        if (whatsappAccountId)
          findAccount(database, context.workspace.id, whatsappAccountId);
        if (
          database.automationRules.some(
            (item) =>
              item.workspaceId === context.workspace.id &&
              item.whatsappAccountId === whatsappAccountId &&
              item.keyword.toLowerCase() === keyword.toLowerCase() &&
              item.matchType === matchType,
          )
        ) {
          throw new ApiError({
            status: 409,
            code: "DUPLICATED_AUTOMATION_RULE",
            message: "Regla duplicada.",
          });
        }
        const item: AutomationRule = {
          id: id("rule"),
          workspaceId: context.workspace.id,
          whatsappAccountId,
          keyword,
          matchType,
          responseText,
          enabled: req.body?.enabled !== false,
          avoidIfAgentResponded: req.body?.avoidIfAgentResponded !== false,
          createdAt: now(),
          updatedAt: now(),
        };
        database.automationRules.push(item);
        return item;
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "automation_rule.created",
        entityType: "automation_rule",
        entityId: rule.id,
        metadata: null,
      });
      ok(res, rule, 201);
    }),
  );

  router.get(
    "/automation-rules/:id",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const rule = database.automationRules.find(
        (item) =>
          item.id === req.params.id &&
          item.workspaceId === context.workspace.id,
      );
      if (!rule)
        throw new ApiError({
          status: 404,
          code: "AUTOMATION_RULE_NOT_FOUND",
          message: "Regla no encontrada.",
        });
      ok(res, rule);
    }),
  );

  router.patch(
    "/automation-rules/:id",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const rule = await store.update((database) => {
        const item = database.automationRules.find(
          (found) =>
            found.id === req.params.id &&
            found.workspaceId === context.workspace.id,
        );
        if (!item)
          throw new ApiError({
            status: 404,
            code: "AUTOMATION_RULE_NOT_FOUND",
            message: "Regla no encontrada.",
          });
        const keyword = readOptionalString(req.body?.keyword);
        const matchType = readOptionalString(req.body?.matchType);
        const responseText = readOptionalString(req.body?.responseText);
        if (keyword) item.keyword = keyword;
        if (matchType) {
          if (!matchTypeValid(matchType))
            throw new ApiError({
              status: 400,
              code: "VALIDATION_ERROR",
              message: "Tipo de coincidencia invalido.",
            });
          item.matchType = matchType;
        }
        if (responseText) item.responseText = responseText;
        if (typeof req.body?.enabled === "boolean")
          item.enabled = req.body.enabled;
        item.updatedAt = now();
        return item;
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "automation_rule.updated",
        entityType: "automation_rule",
        entityId: rule.id,
        metadata: null,
      });
      ok(res, rule);
    }),
  );

  router.delete(
    "/automation-rules/:id",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      await store.update((database) => {
        const index = database.automationRules.findIndex(
          (item) =>
            item.id === req.params.id &&
            item.workspaceId === context.workspace.id,
        );
        if (index === -1)
          throw new ApiError({
            status: 404,
            code: "AUTOMATION_RULE_NOT_FOUND",
            message: "Regla no encontrada.",
          });
        database.automationRules.splice(index, 1);
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "automation_rule.deleted",
        entityType: "automation_rule",
        entityId: req.params.id,
        metadata: null,
      });
      ok(res, { id: req.params.id, deleted: true });
    }),
  );

  router.post(
    "/automation-rules/test",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const incomingText = requireString(
        req.body?.incomingText,
        "incomingText",
      ).toLowerCase();
      const database = await store.read();
      const rule = database.automationRules.find((item) => {
        if (item.workspaceId !== context.workspace.id || !item.enabled)
          return false;
        const keyword = item.keyword.toLowerCase();
        if (item.matchType === "exact") return incomingText === keyword;
        if (item.matchType === "starts_with")
          return incomingText.startsWith(keyword);
        return incomingText.includes(keyword);
      });
      ok(
        res,
        rule
          ? {
              matched: true,
              rule: {
                id: rule.id,
                keyword: rule.keyword,
                matchType: rule.matchType,
              },
              responseText: rule.responseText,
            }
          : { matched: false, rule: null, responseText: null },
      );
    }),
  );

  router.get(
    "/bots",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const rows = database.bots
        .filter((item) => item.workspaceId === context.workspace.id)
        .map((bot) => ({
          id: bot.id,
          name: bot.name,
          instructions: bot.instructions,
          status: bot.status,
          externalAssistantId: bot.externalAssistantId,
          clientId: bot.clientId,
          hasClientToken: Boolean(bot.clientToken),
          createdAt: bot.createdAt,
          updatedAt: bot.updatedAt,
        }));
      const page = pageResponse(rows, req.query);
      paginated(res, page.items, { ...page.pagination, total: page.total });
    }),
  );

  router.post(
    "/bots",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const name = requireString(req.body?.name, "name");
      const instructions = requireString(
        req.body?.instructions,
        "instructions",
      );
      const status = botStatusValid(req.body?.status)
        ? req.body.status
        : "active";
      if (name.length > 100 || instructions.length > 8000) {
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Bot invalido.",
        });
      }

      const clientId =
        readOptionalString(req.body?.clientId) ??
        `taku_${context.workspace.id}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
      const clientToken =
        readOptionalString(req.body?.clientToken) ??
        (await botClient.ensureClientAccount(clientId));
      if (!clientToken) {
        throw new ApiError({
          status: 502,
          code: "BOT_CLIENT_TOKEN_UNAVAILABLE",
          message: "Bot Service no regreso un client_token.",
        });
      }
      const assistant = await botClient.createAssistant({
        clientId,
        clientToken,
        name,
        instructions,
      });

      const bot = await store.update((database) => {
        const item = {
          id: id("bot"),
          workspaceId: context.workspace.id,
          name,
          instructions,
          status,
          externalAssistantId: assistant?.id ?? null,
          clientId,
          clientToken,
          createdAt: now(),
          updatedAt: now(),
        };
        database.bots.push(item);
        return item;
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "bot.created",
        entityType: "bot",
        entityId: bot.id,
        metadata: { externalAssistantId: bot.externalAssistantId },
      });
      ok(
        res,
        {
          ...bot,
          clientToken: undefined,
          hasClientToken: Boolean(bot.clientToken),
        },
        201,
      );
    }),
  );

  router.patch(
    "/bots/:id",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const snapshot = await store.read();
      const current = snapshot.bots.find(
        (item) =>
          item.id === req.params.id &&
          item.workspaceId === context.workspace.id,
      );
      if (!current)
        throw new ApiError({
          status: 404,
          code: "BOT_NOT_FOUND",
          message: "Bot no encontrado.",
        });
      const name = readOptionalString(req.body?.name) ?? current.name;
      const instructions =
        readOptionalString(req.body?.instructions) ?? current.instructions;
      const status = botStatusValid(req.body?.status)
        ? req.body.status
        : current.status;

      if (
        current.clientId &&
        current.clientToken &&
        current.externalAssistantId
      ) {
        await botClient.updateAssistant({
          clientId: current.clientId,
          clientToken: current.clientToken,
          assistantId: current.externalAssistantId,
          name,
          instructions,
        });
      }

      const bot = await store.update((database) => {
        const item = database.bots.find(
          (found) =>
            found.id === req.params.id &&
            found.workspaceId === context.workspace.id,
        );
        if (!item)
          throw new ApiError({
            status: 404,
            code: "BOT_NOT_FOUND",
            message: "Bot no encontrado.",
          });
        item.name = name;
        item.instructions = instructions;
        item.status = status;
        item.updatedAt = now();
        return item;
      });
      ok(res, { ...bot, clientToken: undefined, hasClientToken: true });
    }),
  );

  router.get(
    "/bot-assignments",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const rows = database.botAssignments
        .filter((item) => item.workspaceId === context.workspace.id)
        .filter((item) =>
          req.query.whatsappAccountId
            ? item.whatsappAccountId === req.query.whatsappAccountId
            : true,
        )
        .map((assignment) => ({
          ...assignment,
          bot:
            database.bots.find((item) => item.id === assignment.botId) ?? null,
          whatsappAccount:
            database.whatsappAccounts.find(
              (item) => item.id === assignment.whatsappAccountId,
            ) ?? null,
        }));
      const page = pageResponse(rows, req.query);
      paginated(res, page.items, { ...page.pagination, total: page.total });
    }),
  );

  router.post(
    "/bot-assignments",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const whatsappAccountId = requireString(
        req.body?.whatsappAccountId,
        "whatsappAccountId",
      );
      const botId = requireString(req.body?.botId, "botId");
      const mode = botAssignmentModeValid(req.body?.mode)
        ? req.body.mode
        : "outside_business_hours";
      const assignment = await store.update((database) => {
        const account = findAccount(
          database,
          context.workspace.id,
          whatsappAccountId,
        );
        const bot = database.bots.find(
          (item) =>
            item.id === botId && item.workspaceId === context.workspace.id,
        );
        if (!bot)
          throw new ApiError({
            status: 404,
            code: "BOT_NOT_FOUND",
            message: "Bot no encontrado.",
          });
        let item = database.botAssignments.find(
          (found) =>
            found.workspaceId === context.workspace.id &&
            found.whatsappAccountId === account.id,
        );
        if (!item) {
          item = {
            id: id("bot_assignment"),
            workspaceId: context.workspace.id,
            whatsappAccountId: account.id,
            botId: bot.id,
            enabled: req.body?.enabled !== false,
            mode,
            createdAt: now(),
            updatedAt: now(),
          };
          database.botAssignments.push(item);
        } else {
          item.botId = bot.id;
          item.enabled = req.body?.enabled !== false;
          item.mode = mode;
          item.updatedAt = now();
        }
        return item;
      });
      await store.audit({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        action: "bot_assignment.upserted",
        entityType: "bot_assignment",
        entityId: assignment.id,
        metadata: null,
      });
      ok(res, assignment, 201);
    }),
  );

  router.patch(
    "/bot-assignments/:id",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const assignment = await store.update((database) => {
        const item = database.botAssignments.find(
          (found) =>
            found.id === req.params.id &&
            found.workspaceId === context.workspace.id,
        );
        if (!item)
          throw new ApiError({
            status: 404,
            code: "BOT_ASSIGNMENT_NOT_FOUND",
            message: "Asignacion no encontrada.",
          });
        if (readOptionalString(req.body?.botId)) {
          const bot = database.bots.find(
            (found) =>
              found.id === req.body.botId &&
              found.workspaceId === context.workspace.id,
          );
          if (!bot)
            throw new ApiError({
              status: 404,
              code: "BOT_NOT_FOUND",
              message: "Bot no encontrado.",
            });
          item.botId = bot.id;
        }
        if (typeof req.body?.enabled === "boolean")
          item.enabled = req.body.enabled;
        if (botAssignmentModeValid(req.body?.mode)) item.mode = req.body.mode;
        item.updatedAt = now();
        return item;
      });
      ok(res, assignment);
    }),
  );

  router.get(
    "/automation-decisions",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      const rows = database.automationDecisionLogs
        .filter((item) => item.workspaceId === context.workspace.id)
        .filter((item) =>
          req.query.whatsappAccountId
            ? item.whatsappAccountId === req.query.whatsappAccountId
            : true,
        )
        .filter((item) =>
          req.query.decision ? item.decision === req.query.decision : true,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((item) => ({
          ...item,
          bot: item.botId
            ? (database.bots.find((bot) => bot.id === item.botId) ?? null)
            : null,
          whatsappAccount:
            database.whatsappAccounts.find(
              (account) => account.id === item.whatsappAccountId,
            ) ?? null,
        }));
      const page = pageResponse(rows, req.query);
      paginated(res, page.items, { ...page.pagination, total: page.total });
    }),
  );

  router.get(
    "/dashboard/overview",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      if (context.role === "agent") {
        ok(res, {
          metrics: {
            myOpenConversations: database.conversations.filter(
              (item) =>
                item.workspaceId === context.workspace.id &&
                item.assignedUserId === context.user.id &&
                item.status === "open",
            ).length,
            unassignedConversations: database.conversations.filter(
              (item) =>
                item.workspaceId === context.workspace.id &&
                !item.assignedUserId,
            ).length,
            unansweredMessages: database.conversations.filter(
              (item) =>
                item.workspaceId === context.workspace.id &&
                item.unreadCount > 0,
            ).length,
          },
          shortcuts: [
            {
              label: "Ver mis conversaciones",
              href: "/conversations?assignedTo=me",
            },
            { label: "Ver sin responder", href: "/conversations?unread=true" },
          ],
        });
        return;
      }
      ok(res, {
        metrics: {
          openConversations: database.conversations.filter(
            (item) =>
              item.workspaceId === context.workspace.id &&
              item.status === "open",
          ).length,
          unansweredMessages: database.conversations.filter(
            (item) =>
              item.workspaceId === context.workspace.id && item.unreadCount > 0,
          ).length,
          connectedWhatsappAccounts: database.whatsappAccounts.filter(
            (item) =>
              item.workspaceId === context.workspace.id &&
              item.status === "connected",
          ).length,
          disconnectedWhatsappAccounts: database.whatsappAccounts.filter(
            (item) =>
              item.workspaceId === context.workspace.id &&
              item.status === "disconnected",
          ).length,
          activeAutomationRules: database.automationRules.filter(
            (item) => item.workspaceId === context.workspace.id && item.enabled,
          ).length,
        },
        alerts: database.whatsappAccounts
          .filter(
            (item) =>
              item.workspaceId === context.workspace.id &&
              item.status === "disconnected",
          )
          .map((item) => ({
            type: "warning",
            code: "WHATSAPP_ACCOUNT_DISCONNECTED",
            message: `El número ${item.displayName} está desconectado.`,
            action: {
              label: "Reconectar",
              href: `/whatsapp-accounts/${item.id}/connect`,
            },
          })),
        recentActivity: database.auditLogs
          .filter((item) => item.workspaceId === context.workspace.id)
          .slice(-10)
          .reverse()
          .map((item) => ({
            id: item.id,
            type: item.action,
            message: item.action,
            createdAt: item.createdAt,
          })),
      });
    }),
  );

  router.get("/profile", (req, res) => {
    const context = assertWorkspace(req);
    ok(res, publicUser(context.user));
  });

  router.patch(
    "/profile",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const name = requireString(req.body?.name, "name");
      const data = await store.update((database) => {
        const user = database.users.find((item) => item.id === context.user.id);
        if (!user)
          throw new ApiError({
            status: 404,
            code: "USER_NOT_FOUND",
            message: "Usuario no encontrado.",
          });
        user.name = name;
        user.updatedAt = now();
        return publicUser(user);
      });
      ok(res, data);
    }),
  );

  router.post(
    "/profile/change-password",
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const currentPassword = requireString(
        req.body?.currentPassword,
        "currentPassword",
      );
      const newPassword = requireString(req.body?.newPassword, "newPassword");
      const confirmation = requireString(
        req.body?.newPasswordConfirmation,
        "newPasswordConfirmation",
      );
      if (newPassword.length < 8 || newPassword !== confirmation)
        throw new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "La contraseña debe tener minimo 8 caracteres y coincidir.",
        });
      await store.update((database) => {
        const user = database.users.find((item) => item.id === context.user.id);
        if (!user || !verifyPassword(currentPassword, user.passwordHash))
          throw new ApiError({
            status: 401,
            code: "INVALID_CREDENTIALS",
            message: "Contraseña actual incorrecta.",
          });
        user.passwordHash = hashPassword(newPassword);
        user.updatedAt = now();
      });
      ok(res, { message: "Contraseña actualizada correctamente." });
    }),
  );

  router.get(
    "/preferences",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const database = await store.read();
      ok(
        res,
        database.preferences.find(
          (item) => item.workspaceId === context.workspace.id,
        ) ?? null,
      );
    }),
  );

  router.patch(
    "/preferences",
    requireRole(ownerAdmin),
    asyncHandler(async (req, res) => {
      const context = assertWorkspace(req);
      const data = await store.update((database) => {
        let preferences = database.preferences.find(
          (item) => item.workspaceId === context.workspace.id,
        );
        if (!preferences) {
          preferences = {
            id: id("preferences"),
            workspaceId: context.workspace.id,
            defaultConversationStatus: "open",
            autoCloseEnabled: false,
            autoCloseAfterHours: null,
            showBotMessages: true,
            agentsCanCloseConversations: true,
            agentsCanReassignConversations: false,
            createdAt: now(),
            updatedAt: now(),
          };
          database.preferences.push(preferences);
        }
        if (statusValid(req.body?.defaultConversationStatus))
          preferences.defaultConversationStatus =
            req.body.defaultConversationStatus;
        if (typeof req.body?.autoCloseEnabled === "boolean")
          preferences.autoCloseEnabled = req.body.autoCloseEnabled;
        if (
          typeof req.body?.autoCloseAfterHours === "number" ||
          req.body?.autoCloseAfterHours === null
        )
          preferences.autoCloseAfterHours = req.body.autoCloseAfterHours;
        if (typeof req.body?.showBotMessages === "boolean")
          preferences.showBotMessages = req.body.showBotMessages;
        if (typeof req.body?.agentsCanCloseConversations === "boolean")
          preferences.agentsCanCloseConversations =
            req.body.agentsCanCloseConversations;
        if (typeof req.body?.agentsCanReassignConversations === "boolean")
          preferences.agentsCanReassignConversations =
            req.body.agentsCanReassignConversations;
        preferences.updatedAt = now();
        return preferences as Preferences;
      });
      ok(res, {
        message: "Preferencias actualizadas correctamente.",
        preferences: data,
      });
    }),
  );

  router.post(
    "/webhooks/bot",
    asyncHandler(async (req, res) => {
      validateWebhook(req, config.botServiceWebhookSecret);
      const externalBotId = requireString(
        req.body?.externalBotId,
        "externalBotId",
      );
      const event = requireString(req.body?.event, "event");
      const data =
        req.body?.data && typeof req.body.data === "object"
          ? (req.body.data as Record<string, unknown>)
          : {};
      const result = await store.update((database) => {
        const settings = database.botSettings.find(
          (item) => item.externalBotId === externalBotId,
        );
        if (!settings)
          throw new ApiError({
            status: 404,
            code: "BOT_SETTINGS_NOT_FOUND",
            message: "Bot no encontrado.",
          });
        if (event !== "bot.message_generated")
          return { workspaceId: settings.workspaceId };
        const conversationId = requireString(
          data.conversationId,
          "conversationId",
        );
        const text = requireString(data.text, "text");
        const conversation = findConversation(
          database,
          settings.workspaceId,
          conversationId,
        );
        const message: Message = {
          id: id("message"),
          workspaceId: settings.workspaceId,
          conversationId,
          whatsappAccountId: conversation.whatsappAccountId,
          contactId: conversation.contactId,
          externalMessageId: null,
          direction: "bot",
          type: "text",
          body: text,
          mediaUrl: null,
          mediaMimeType: null,
          mediaFilename: null,
          status: "sent",
          sentByUserId: null,
          createdAt: now(),
          updatedAt: now(),
        };
        database.messages.push(message);
        conversation.lastMessageBody = text;
        conversation.lastMessageAt = message.createdAt;
        conversation.updatedAt = now();
        return {
          workspaceId: settings.workspaceId,
          message: messageView(message, database),
          conversation: conversationView(conversation, database),
        };
      });
      if ("message" in result)
        realtime.emitToWorkspace(
          result.workspaceId,
          "bot.reply.created",
          result,
        );
      ok(res, { received: true });
    }),
  );

  return router;
}
