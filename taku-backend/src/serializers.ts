import type {
  AdminUser,
  Contact,
  Conversation,
  Database,
  Message,
  User,
  WhatsAppAccount,
  Workspace,
} from "./types.js";

export function publicAdminUser(adminUser: AdminUser) {
  return {
    id: adminUser.id,
    name: adminUser.name,
    email: adminUser.email,
    role: adminUser.role,
    status: adminUser.status,
    requires2fa: adminUser.requires2fa,
    twoFactorEnabled: adminUser.twoFactorEnabled,
    lastLoginAt: adminUser.lastLoginAt,
    createdAt: adminUser.createdAt,
    updatedAt: adminUser.updatedAt,
  };
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function workspaceWithRole(workspace: Workspace, role: string) {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    status: workspace.status,
    plan: workspace.plan,
    timezone: workspace.timezone,
    role,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

export function whatsappAccountView(
  account: WhatsAppAccount,
  database?: Database,
) {
  const accountSettings = database?.botSettings.find(
    (item) =>
      item.workspaceId === account.workspaceId &&
      item.whatsappAccountId === account.id,
  );
  const workspaceSettings = database?.botSettings.find(
    (item) =>
      item.workspaceId === account.workspaceId &&
      item.whatsappAccountId === null,
  );
  const settings = accountSettings ?? workspaceSettings;
  return {
    id: account.id,
    displayName: account.displayName,
    description: account.description,
    phoneNumber: account.phoneNumber,
    status: account.status,
    automationEnabled: settings?.enabled ?? false,
    useWorkspaceBusinessHours: account.useWorkspaceBusinessHours,
    useWorkspaceBotSettings: account.useWorkspaceBotSettings,
    enabled: account.enabled,
    lastConnectedAt: account.lastConnectedAt,
    lastDisconnectedAt: account.lastDisconnectedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function contactView(contact: Contact, database?: Database) {
  const lastConversation = database?.conversations
    .filter((conversation) => conversation.contactId === contact.id)
    .sort((left, right) =>
      (right.lastMessageAt ?? "").localeCompare(left.lastMessageAt ?? ""),
    )[0];
  return {
    id: contact.id,
    name: contact.name,
    phoneNumber: contact.phoneNumber,
    profilePictureUrl: contact.profilePictureUrl,
    notes: contact.notes,
    lastConversationAt: lastConversation?.lastMessageAt ?? null,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

export function conversationView(
  conversation: Conversation,
  database: Database,
) {
  const contact = database.contacts.find(
    (item) => item.id === conversation.contactId,
  );
  const account = database.whatsappAccounts.find(
    (item) => item.id === conversation.whatsappAccountId,
  );
  const assignedUser = conversation.assignedUserId
    ? database.users.find((item) => item.id === conversation.assignedUserId)
    : null;
  const lastMessage = database.messages
    .filter((message) => message.conversationId === conversation.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  return {
    id: conversation.id,
    status: conversation.status,
    contact: contact
      ? {
          id: contact.id,
          name: contact.name,
          phoneNumber: contact.phoneNumber,
          profilePictureUrl: contact.profilePictureUrl,
        }
      : null,
    whatsappAccount: account
      ? {
          id: account.id,
          displayName: account.displayName,
          phoneNumber: account.phoneNumber,
          status: account.status,
        }
      : null,
    assignedUser: assignedUser
      ? { id: assignedUser.id, name: assignedUser.name }
      : null,
    lastMessage: lastMessage
      ? {
          body: lastMessage.body,
          direction: lastMessage.direction,
          createdAt: lastMessage.createdAt,
        }
      : null,
    unreadCount: conversation.unreadCount,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export function messageView(message: Message, database: Database) {
  const sentByUser = message.sentByUserId
    ? database.users.find((user) => user.id === message.sentByUserId)
    : null;
  return {
    id: message.id,
    externalMessageId: message.externalMessageId,
    direction: message.direction,
    type: message.type,
    body: message.body,
    mediaUrl: message.mediaUrl,
    mediaMimeType: message.mediaMimeType,
    mediaFilename: message.mediaFilename,
    status: message.status,
    sentByUser: sentByUser
      ? { id: sentByUser.id, name: sentByUser.name }
      : null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}
