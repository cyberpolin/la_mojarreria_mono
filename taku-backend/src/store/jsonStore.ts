import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../auth.js";
import { config, isDemoSeedEnvironment } from "../config.js";
import type {
  AdminAuditLog,
  AdminUser,
  AuditLog,
  BotAssignment,
  AutomationRule,
  AutomationBlockedContact,
  TakuBot,
  BotSettings,
  BusinessHour,
  Contact,
  Conversation,
  Database,
  Membership,
  Message,
  PaymentIntent,
  Preferences,
  User,
  WhatsAppAccount,
  Workspace,
} from "../types.js";

function now() {
  return new Date().toISOString();
}

export function id(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

const superUser = {
  id: "user_superadmin",
  name: "TAKU Superadmin",
};

function createEmptyDatabase(): Database {
  return {
    adminUsers: [],
    adminAuditLogs: [],
    adminRefreshTokens: [],
    workspaces: [],
    users: [],
    memberships: [],
    whatsappAccounts: [],
    contacts: [],
    conversations: [],
    messages: [],
    businessHours: [],
    botSettings: [],
    bots: [],
    botAssignments: [],
    automationRules: [],
    automationBlockedContacts: [],
    automationDecisionLogs: [],
    paymentIntents: [],
    preferences: [],
    auditLogs: [],
    refreshTokens: [],
  };
}

function ensureDatabaseCollections(database: Database) {
  const target = database as Database & Partial<Database>;
  target.adminUsers ??= [];
  target.adminAuditLogs ??= [];
  target.adminRefreshTokens ??= [];
  target.workspaces ??= [];
  target.users ??= [];
  target.memberships ??= [];
  target.whatsappAccounts ??= [];
  target.contacts ??= [];
  target.conversations ??= [];
  target.messages ??= [];
  target.businessHours ??= [];
  target.botSettings ??= [];
  target.bots ??= [];
  target.botAssignments ??= [];
  target.automationRules ??= [];
  target.automationBlockedContacts ??= [];
  target.automationDecisionLogs ??= [];
  target.paymentIntents ??= [];
  target.preferences ??= [];
  target.auditLogs ??= [];
  target.refreshTokens ??= [];
}

function minutesAgo(base: string, minutes: number) {
  return new Date(Date.parse(base) - minutes * 60_000).toISOString();
}

function seedTextMessage(params: {
  id: string;
  workspaceId: string;
  conversationId: string;
  whatsappAccountId: string;
  contactId: string;
  direction: Message["direction"];
  body: string;
  status: Message["status"];
  sentByUserId: string | null;
  createdAt: string;
}): Message {
  return {
    id: params.id,
    workspaceId: params.workspaceId,
    conversationId: params.conversationId,
    whatsappAccountId: params.whatsappAccountId,
    contactId: params.contactId,
    externalMessageId: `${params.id}_ext`,
    direction: params.direction,
    type: "text",
    body: params.body,
    mediaUrl: null,
    mediaMimeType: null,
    mediaFilename: null,
    status: params.status,
    sentByUserId: params.sentByUserId,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  };
}

function seedLocationMessage(params: {
  id: string;
  workspaceId: string;
  conversationId: string;
  whatsappAccountId: string;
  contactId: string;
  body: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}): Message {
  return {
    id: params.id,
    workspaceId: params.workspaceId,
    conversationId: params.conversationId,
    whatsappAccountId: params.whatsappAccountId,
    contactId: params.contactId,
    externalMessageId: `${params.id}_ext`,
    direction: "inbound",
    type: "location",
    body: params.body,
    mediaUrl: `https://maps.google.com/?q=${params.latitude},${params.longitude}`,
    mediaMimeType: "application/geo",
    mediaFilename: null,
    latitude: params.latitude,
    longitude: params.longitude,
    status: "received",
    sentByUserId: null,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  };
}

function createDemoConversationsSeed(params: {
  workspaceId: string;
  salesAccount: WhatsAppAccount;
  supportAccount: WhatsAppAccount;
  adminId: string;
  agentId: string;
  timestamp: string;
}) {
  const {
    workspaceId,
    salesAccount,
    supportAccount,
    adminId,
    agentId,
    timestamp,
  } = params;

  const juan: Contact = {
    id: "contact_juan",
    workspaceId,
    phoneNumber: "5219931234567",
    name: "Juan Perez",
    profilePictureUrl: null,
    notes: "Cliente frecuente. Prefiere atencion por la tarde.",
    createdAt: minutesAgo(timestamp, 180),
    updatedAt: timestamp,
  };
  const maria: Contact = {
    id: "contact_maria",
    workspaceId,
    phoneNumber: "5219987654321",
    name: "Maria Lopez",
    profilePictureUrl: null,
    notes: "Pedido de mojarras para el sabado.",
    createdAt: minutesAgo(timestamp, 240),
    updatedAt: minutesAgo(timestamp, 12),
  };
  const pedro: Contact = {
    id: "contact_pedro",
    workspaceId,
    phoneNumber: "5215551234567",
    name: "Pedro Sanchez",
    profilePictureUrl: null,
    notes: "Duda post-compra.",
    createdAt: minutesAgo(timestamp, 300),
    updatedAt: minutesAgo(timestamp, 40),
  };
  const ana: Contact = {
    id: "contact_ana",
    workspaceId,
    phoneNumber: "5212223344556",
    name: "Ana Ruiz",
    profilePictureUrl: null,
    notes: "Nueva lead de Instagram.",
    createdAt: minutesAgo(timestamp, 90),
    updatedAt: minutesAgo(timestamp, 5),
  };

  const juanConversation: Conversation = {
    id: "conversation_juan_sales",
    workspaceId,
    whatsappAccountId: salesAccount.id,
    contactId: juan.id,
    status: "open",
    lastMessageBody: "Plaza de Armas",
    lastMessageAt: minutesAgo(timestamp, 3),
    assignedUserId: adminId,
    unreadCount: 1,
    createdAt: minutesAgo(timestamp, 180),
    updatedAt: minutesAgo(timestamp, 3),
  };
  const mariaConversation: Conversation = {
    id: "conversation_maria_sales",
    workspaceId,
    whatsappAccountId: salesAccount.id,
    contactId: maria.id,
    status: "open",
    lastMessageBody: "Si, para 8 personas por favor",
    lastMessageAt: minutesAgo(timestamp, 12),
    assignedUserId: agentId,
    unreadCount: 0,
    createdAt: minutesAgo(timestamp, 240),
    updatedAt: minutesAgo(timestamp, 12),
  };
  const pedroConversation: Conversation = {
    id: "conversation_pedro_support",
    workspaceId,
    whatsappAccountId: supportAccount.id,
    contactId: pedro.id,
    status: "pending",
    lastMessageBody: "El pedido llego incompleto",
    lastMessageAt: minutesAgo(timestamp, 40),
    assignedUserId: null,
    unreadCount: 2,
    createdAt: minutesAgo(timestamp, 300),
    updatedAt: minutesAgo(timestamp, 40),
  };
  const anaConversation: Conversation = {
    id: "conversation_ana_sales",
    workspaceId,
    whatsappAccountId: salesAccount.id,
    contactId: ana.id,
    status: "open",
    lastMessageBody: "Hola, vi sus mojarras en Instagram",
    lastMessageAt: minutesAgo(timestamp, 5),
    assignedUserId: null,
    unreadCount: 1,
    createdAt: minutesAgo(timestamp, 90),
    updatedAt: minutesAgo(timestamp, 5),
  };

  const messages: Message[] = [
    seedTextMessage({
      id: "message_inbound_1",
      workspaceId,
      conversationId: juanConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: juan.id,
      direction: "inbound",
      body: "Hola, necesito una cotizacion",
      status: "received",
      sentByUserId: null,
      createdAt: minutesAgo(timestamp, 50),
    }),
    seedTextMessage({
      id: "message_juan_outbound_1",
      workspaceId,
      conversationId: juanConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: juan.id,
      direction: "outbound",
      body: "Claro Juan, para cuantas personas seria?",
      status: "sent",
      sentByUserId: adminId,
      createdAt: minutesAgo(timestamp, 46),
    }),
    seedTextMessage({
      id: "message_juan_bot_1",
      workspaceId,
      conversationId: juanConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: juan.id,
      direction: "bot",
      body: "Tambien puedes pedirnos el menu del dia cuando gustes.",
      status: "sent",
      sentByUserId: null,
      createdAt: minutesAgo(timestamp, 44),
    }),
    seedTextMessage({
      id: "message_juan_inbound_2",
      workspaceId,
      conversationId: juanConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: juan.id,
      direction: "inbound",
      body: "Para 6 personas. Pueden para hoy?",
      status: "received",
      sentByUserId: null,
      createdAt: minutesAgo(timestamp, 20),
    }),
    seedTextMessage({
      id: "message_juan_outbound_2",
      workspaceId,
      conversationId: juanConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: juan.id,
      direction: "outbound",
      body: "Si, las tenemos listas. Te agendo a las 2 pm.",
      status: "sent",
      sentByUserId: adminId,
      createdAt: minutesAgo(timestamp, 15),
    }),
    seedTextMessage({
      id: "message_juan_inbound_3",
      workspaceId,
      conversationId: juanConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: juan.id,
      direction: "inbound",
      body: "Perfecto, a las 2 pm esta bien",
      status: "received",
      sentByUserId: null,
      createdAt: minutesAgo(timestamp, 8),
    }),
    seedLocationMessage({
      id: "message_juan_location_1",
      workspaceId,
      conversationId: juanConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: juan.id,
      body: "Plaza de Armas",
      latitude: 17.9869,
      longitude: -92.9303,
      createdAt: minutesAgo(timestamp, 3),
    }),
    seedTextMessage({
      id: "message_maria_inbound_1",
      workspaceId,
      conversationId: mariaConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: maria.id,
      direction: "inbound",
      body: "Buenas tardes, quieren mojarras para el sabado?",
      status: "received",
      sentByUserId: null,
      createdAt: minutesAgo(timestamp, 80),
    }),
    seedTextMessage({
      id: "message_maria_outbound_1",
      workspaceId,
      conversationId: mariaConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: maria.id,
      direction: "outbound",
      body: "Hola Maria, si tenemos. Cuantas personas serian?",
      status: "sent",
      sentByUserId: agentId,
      createdAt: minutesAgo(timestamp, 70),
    }),
    seedTextMessage({
      id: "message_maria_inbound_2",
      workspaceId,
      conversationId: mariaConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: maria.id,
      direction: "inbound",
      body: "Si, para 8 personas por favor",
      status: "received",
      sentByUserId: null,
      createdAt: minutesAgo(timestamp, 12),
    }),
    seedTextMessage({
      id: "message_pedro_inbound_1",
      workspaceId,
      conversationId: pedroConversation.id,
      whatsappAccountId: supportAccount.id,
      contactId: pedro.id,
      direction: "inbound",
      body: "Hola, pedi ayer y me falto una orden",
      status: "received",
      sentByUserId: null,
      createdAt: minutesAgo(timestamp, 55),
    }),
    seedTextMessage({
      id: "message_pedro_system_1",
      workspaceId,
      conversationId: pedroConversation.id,
      whatsappAccountId: supportAccount.id,
      contactId: pedro.id,
      direction: "system",
      body: "Conversacion actualizada a pending.",
      status: "created",
      sentByUserId: adminId,
      createdAt: minutesAgo(timestamp, 50),
    }),
    seedTextMessage({
      id: "message_pedro_inbound_2",
      workspaceId,
      conversationId: pedroConversation.id,
      whatsappAccountId: supportAccount.id,
      contactId: pedro.id,
      direction: "inbound",
      body: "El pedido llego incompleto",
      status: "received",
      sentByUserId: null,
      createdAt: minutesAgo(timestamp, 40),
    }),
    seedTextMessage({
      id: "message_ana_inbound_1",
      workspaceId,
      conversationId: anaConversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: ana.id,
      direction: "inbound",
      body: "Hola, vi sus mojarras en Instagram",
      status: "received",
      sentByUserId: null,
      createdAt: minutesAgo(timestamp, 5),
    }),
  ];

  return {
    contacts: [juan, maria, pedro, ana],
    conversations: [
      juanConversation,
      mariaConversation,
      pedroConversation,
      anaConversation,
    ],
    messages,
  };
}

function createTestSeed(): Database {
  const timestamp = now();
  const workspace: Workspace = {
    id: "workspace_demo",
    name: "La Mojarreria",
    slug: "la-mojarreria",
    status: "active",
    plan: "starter",
    timezone: "America/Mexico_City",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const owner: User = {
    id: "user_owner",
    name: "Owner Demo",
    email: "owner@owner.com",
    passwordHash: hashPassword("owner"),
    status: "active",
    lastLoginAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const admin: User = {
    id: "user_admin",
    name: "Admin Demo",
    email: "admin@admin.com",
    passwordHash: hashPassword("admin"),
    status: "active",
    lastLoginAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const agent: User = {
    id: "user_agent",
    name: "Agent Demo",
    email: "agent@agent.com",
    passwordHash: hashPassword("agent"),
    status: "active",
    lastLoginAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const memberships: Membership[] = [
    {
      id: "membership_owner",
      workspaceId: workspace.id,
      userId: owner.id,
      role: "owner",
      status: "active",
      invitationSentAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "membership_admin",
      workspaceId: workspace.id,
      userId: admin.id,
      role: "admin",
      status: "active",
      invitationSentAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "membership_agent",
      workspaceId: workspace.id,
      userId: agent.id,
      role: "agent",
      status: "active",
      invitationSentAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  const salesAccount: WhatsAppAccount = {
    id: "wa_account_sales",
    workspaceId: workspace.id,
    externalInstanceId: "wa_demo_sales",
    phoneNumber: "5219931204488",
    displayName: "Ventas",
    description: "Numero principal para pedidos y cotizaciones",
    timezone: workspace.timezone,
    status: "connected",
    qrCode: null,
    enabled: true,
    useWorkspaceBusinessHours: true,
    useWorkspaceBotSettings: true,
    lastConnectedAt: timestamp,
    lastDisconnectedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const supportAccount: WhatsAppAccount = {
    id: "wa_account_support",
    workspaceId: workspace.id,
    externalInstanceId: "wa_demo_support",
    phoneNumber: "5219932047711",
    displayName: "Soporte",
    description: "Numero para dudas despues de compra",
    timezone: workspace.timezone,
    status: "disconnected",
    qrCode: null,
    enabled: true,
    useWorkspaceBusinessHours: true,
    useWorkspaceBotSettings: true,
    lastConnectedAt: null,
    lastDisconnectedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const inboxSeed = createDemoConversationsSeed({
    workspaceId: workspace.id,
    salesAccount,
    supportAccount,
    adminId: admin.id,
    agentId: agent.id,
    timestamp,
  });
  const businessHours: BusinessHour[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    id: `business_hour_${day}`,
    workspaceId: workspace.id,
    whatsappAccountId: null,
    dayOfWeek: day,
    opensAt: day === 0 ? null : day === 6 ? "10:00" : "09:00",
    closesAt: day === 0 ? null : day === 6 ? "14:00" : "18:00",
    isClosed: day === 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  const botSettings: BotSettings = {
    id: "bot_settings_workspace",
    workspaceId: workspace.id,
    whatsappAccountId: null,
    enabled: true,
    afterHoursEnabled: true,
    afterHoursResponder: "static_message",
    afterHoursMessage:
      "Gracias por escribir. Estamos fuera de horario. Te responderemos el siguiente dia habil.",
    rulesEnabled: true,
    aiEnabled: false,
    externalBotId: "bot_demo_workspace",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const bots: TakuBot[] = [
    {
      id: "bot_demo_customer_assistant",
      workspaceId: workspace.id,
      name: "Customer assistant",
      instructions:
        "Responde de forma breve y amable. Si no tienes informacion suficiente, pide el nombre del cliente y ofrece que un agente lo atienda.",
      status: "active",
      externalAssistantId: null,
      clientId: null,
      clientToken: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  const botAssignments: BotAssignment[] = [
    {
      id: "bot_assignment_sales",
      workspaceId: workspace.id,
      whatsappAccountId: salesAccount.id,
      botId: bots[0]!.id,
      enabled: true,
      mode: "outside_business_hours",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  const automationRules: AutomationRule[] = [
    {
      id: "rule_horario",
      workspaceId: workspace.id,
      whatsappAccountId: null,
      keyword: "horario",
      matchType: "contains",
      responseText:
        "Nuestro horario es de lunes a viernes de 9:00 AM a 6:00 PM.",
      enabled: true,
      avoidIfAgentResponded: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  const automationBlockedContacts: AutomationBlockedContact[] = [];
  const preferences: Preferences = {
    id: "preferences_workspace",
    workspaceId: workspace.id,
    defaultConversationStatus: "open",
    autoCloseEnabled: false,
    autoCloseAfterHours: null,
    showBotMessages: true,
    agentsCanCloseConversations: true,
    agentsCanReassignConversations: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    adminUsers: [],
    adminAuditLogs: [],
    adminRefreshTokens: [],
    workspaces: [workspace],
    users: [owner, admin, agent],
    memberships,
    whatsappAccounts: [salesAccount, supportAccount],
    contacts: inboxSeed.contacts,
    conversations: inboxSeed.conversations,
    messages: inboxSeed.messages,
    businessHours,
    botSettings: [botSettings],
    bots,
    botAssignments,
    automationRules,
    automationBlockedContacts,
    automationDecisionLogs: [],
    paymentIntents: [] as PaymentIntent[],
    preferences: [preferences],
    auditLogs: [],
    refreshTokens: [],
  };
}

function addMissingById<T extends { id: string }>(target: T[], fixtures: T[]) {
  let changed = false;
  for (const fixture of fixtures) {
    if (!target.some((item) => item.id === fixture.id)) {
      target.push(fixture);
      changed = true;
    }
  }
  return changed;
}

function ensureTestUserCredentials(database: Database) {
  if (!isDemoSeedEnvironment) return false;
  const timestamp = now();
  const fixtures = [
    {
      id: "user_owner",
      name: "Owner Demo",
      email: "owner@owner.com",
      password: "owner",
    },
    {
      id: "user_admin",
      name: "Admin Demo",
      email: "admin@admin.com",
      password: "admin",
    },
    {
      id: "user_agent",
      name: "Agent Demo",
      email: "agent@agent.com",
      password: "agent",
    },
  ];
  let changed = false;
  for (const fixture of fixtures) {
    const user = database.users.find((item) => item.id === fixture.id);
    if (!user) continue;
    let userChanged = false;
    if (user.name !== fixture.name) {
      user.name = fixture.name;
      userChanged = true;
    }
    if (user.email !== fixture.email) {
      user.email = fixture.email;
      userChanged = true;
    }
    if (!verifyPassword(fixture.password, user.passwordHash)) {
      user.passwordHash = hashPassword(fixture.password);
      userChanged = true;
    }
    if (userChanged) {
      user.updatedAt = timestamp;
      changed = true;
    }
  }
  return changed;
}

function ensureSuperUser(database: Database) {
  let changed = false;
  const timestamp = now();
  const email = config.superAdminEmail.toLowerCase();
  let adminUser = database.adminUsers.find(
    (item) => item.email.toLowerCase() === email || item.id === superUser.id,
  );
  if (!adminUser) {
    adminUser = {
      id: superUser.id,
      name: superUser.name,
      email,
      passwordHash: hashPassword(config.superAdminPassword),
      role: "super_owner",
      status: "active",
      requires2fa: false,
      twoFactorEnabled: false,
      lastLoginAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    database.adminUsers.push(adminUser);
    changed = true;
  } else if (
    adminUser.name !== superUser.name ||
    adminUser.email !== email ||
    adminUser.status !== "active" ||
    adminUser.role !== "super_owner"
  ) {
    adminUser.name = superUser.name;
    adminUser.email = email;
    adminUser.status = "active";
    adminUser.role = "super_owner";
    adminUser.updatedAt = timestamp;
    changed = true;
  }

  return changed;
}

function ensureTestData(database: Database) {
  if (!isDemoSeedEnvironment) return false;
  const testSeed = createTestSeed();
  let changed = false;
  changed = addMissingById(database.workspaces, testSeed.workspaces) || changed;
  changed = addMissingById(database.users, testSeed.users) || changed;
  changed = ensureTestUserCredentials(database) || changed;
  changed =
    addMissingById(database.memberships, testSeed.memberships) || changed;
  changed =
    addMissingById(database.whatsappAccounts, testSeed.whatsappAccounts) ||
    changed;
  changed = addMissingById(database.contacts, testSeed.contacts) || changed;
  changed =
    addMissingById(database.conversations, testSeed.conversations) || changed;
  changed = addMissingById(database.messages, testSeed.messages) || changed;
  changed =
    addMissingById(database.businessHours, testSeed.businessHours) || changed;
  changed =
    addMissingById(database.botSettings, testSeed.botSettings) || changed;
  changed = addMissingById(database.bots, testSeed.bots) || changed;
  changed =
    addMissingById(database.botAssignments, testSeed.botAssignments) || changed;
  changed =
    addMissingById(database.automationRules, testSeed.automationRules) ||
    changed;
  changed =
    addMissingById(
      database.automationBlockedContacts,
      testSeed.automationBlockedContacts,
    ) || changed;
  changed =
    addMissingById(database.preferences, testSeed.preferences) || changed;
  return changed;
}

function hydrateSeed(database: Database) {
  ensureDatabaseCollections(database);
  let changed = ensureSuperUser(database);
  changed = ensureTestData(database) || changed;
  return changed;
}

function createSeed(): Database {
  const database = createEmptyDatabase();
  hydrateSeed(database);
  return database;
}

export class JsonStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<Database> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const database = JSON.parse(raw) as Database;
      if (hydrateSeed(database)) {
        await this.write(database);
      }
      return database;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        const seed = createSeed();
        await this.write(seed);
        return seed;
      }
      throw error;
    }
  }

  async write(database: Database): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
  }

  async update<T>(mutator: (database: Database) => T): Promise<T> {
    const database = await this.read();
    const result = mutator(database);
    await this.write(database);
    return result;
  }

  async audit(params: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
    return this.update((database) => {
      const log: AuditLog = {
        id: id("audit"),
        createdAt: now(),
        ...params,
      };
      database.auditLogs.push(log);
      return log;
    });
  }

  async adminAudit(
    params: Omit<AdminAuditLog, "id" | "createdAt">,
  ): Promise<AdminAuditLog> {
    return this.update((database) => {
      const log: AdminAuditLog = {
        id: id("admin_audit"),
        createdAt: now(),
        ...params,
      };
      database.adminAuditLogs.push(log);
      return log;
    });
  }
}

export { now };
