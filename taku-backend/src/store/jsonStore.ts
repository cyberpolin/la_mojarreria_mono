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
  TakuBot,
  BotSettings,
  BusinessHour,
  Contact,
  Conversation,
  Database,
  Membership,
  Message,
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
    automationDecisionLogs: [],
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
  target.automationDecisionLogs ??= [];
  target.preferences ??= [];
  target.auditLogs ??= [];
  target.refreshTokens ??= [];
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
  const contact: Contact = {
    id: "contact_juan",
    workspaceId: workspace.id,
    phoneNumber: "5219931234567",
    name: "Juan Perez",
    profilePictureUrl: null,
    notes: "Cliente frecuente. Prefiere atencion por la tarde.",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const conversation: Conversation = {
    id: "conversation_juan_sales",
    workspaceId: workspace.id,
    whatsappAccountId: salesAccount.id,
    contactId: contact.id,
    status: "open",
    lastMessageBody: "Necesito una cotizacion",
    lastMessageAt: timestamp,
    assignedUserId: admin.id,
    unreadCount: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const messages: Message[] = [
    {
      id: "message_inbound_1",
      workspaceId: workspace.id,
      conversationId: conversation.id,
      whatsappAccountId: salesAccount.id,
      contactId: contact.id,
      externalMessageId: "wa_message_inbound_1",
      direction: "inbound",
      type: "text",
      body: "Hola, necesito una cotizacion",
      mediaUrl: null,
      mediaMimeType: null,
      mediaFilename: null,
      status: "received",
      sentByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
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
    contacts: [contact],
    conversations: [conversation],
    messages,
    businessHours,
    botSettings: [botSettings],
    bots,
    botAssignments,
    automationRules,
    automationDecisionLogs: [],
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
