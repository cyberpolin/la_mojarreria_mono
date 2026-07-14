export type Role = "owner" | "admin" | "agent";
export type AdminRole =
  | "super_owner"
  | "super_admin"
  | "support_admin"
  | "billing_admin"
  | "readonly_admin";
export type WorkspaceStatus = "trial" | "active" | "suspended" | "cancelled";
export type WorkspacePlan = "starter" | "business" | "enterprise";
export type UserStatus = "active" | "disabled" | "invited";
export type AdminUserStatus = "active" | "disabled" | "invited";
export type WhatsAppStatus =
  | "pending"
  | "qr_required"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "disabled";
export type ConversationStatus = "open" | "pending" | "closed" | "archived";
export type MessageDirection = "inbound" | "outbound" | "bot" | "system";
export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "sticker"
  | "unknown";
export type MessageStatus =
  | "created"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "received";
export type MatchType = "exact" | "contains" | "starts_with";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  status: WorkspaceStatus;
  plan: WorkspacePlan;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Membership = {
  id: string;
  workspaceId: string;
  userId: string;
  role: Role;
  status: UserStatus;
  invitationSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppAccount = {
  id: string;
  workspaceId: string;
  externalInstanceId: string;
  phoneNumber: string | null;
  displayName: string;
  description: string | null;
  timezone: string;
  status: WhatsAppStatus;
  qrCode: string | null;
  enabled: boolean;
  useWorkspaceBusinessHours: boolean;
  useWorkspaceBotSettings: boolean;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Contact = {
  id: string;
  workspaceId: string;
  phoneNumber: string;
  name: string | null;
  profilePictureUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Conversation = {
  id: string;
  workspaceId: string;
  whatsappAccountId: string;
  contactId: string;
  status: ConversationStatus;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  assignedUserId: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  workspaceId: string;
  conversationId: string;
  whatsappAccountId: string;
  contactId: string;
  externalMessageId: string | null;
  direction: MessageDirection;
  type: MessageType;
  body: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  status: MessageStatus;
  sentByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessHour = {
  id: string;
  workspaceId: string;
  whatsappAccountId: string | null;
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BotSettings = {
  id: string;
  workspaceId: string;
  whatsappAccountId: string | null;
  enabled: boolean;
  afterHoursEnabled: boolean;
  afterHoursMessage: string | null;
  rulesEnabled: boolean;
  aiEnabled: boolean;
  externalBotId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRule = {
  id: string;
  workspaceId: string;
  whatsappAccountId: string | null;
  keyword: string;
  matchType: MatchType;
  responseText: string;
  enabled: boolean;
  avoidIfAgentResponded: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Preferences = {
  id: string;
  workspaceId: string;
  defaultConversationStatus: ConversationStatus;
  autoCloseEnabled: boolean;
  autoCloseAfterHours: number | null;
  showBotMessages: boolean;
  agentsCanCloseConversations: boolean;
  agentsCanReassignConversations: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  workspaceId: string | null;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  status: AdminUserStatus;
  requires2fa: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAuditLog = {
  id: string;
  adminUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  workspaceId: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type Database = {
  adminUsers: AdminUser[];
  adminAuditLogs: AdminAuditLog[];
  adminRefreshTokens: Array<{
    id: string;
    adminUserId: string;
    tokenHash: string;
    expiresAt: string;
    revokedAt: string | null;
    createdAt: string;
  }>;
  workspaces: Workspace[];
  users: User[];
  memberships: Membership[];
  whatsappAccounts: WhatsAppAccount[];
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
  businessHours: BusinessHour[];
  botSettings: BotSettings[];
  automationRules: AutomationRule[];
  preferences: Preferences[];
  auditLogs: AuditLog[];
  refreshTokens: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: string;
    revokedAt: string | null;
    createdAt: string;
  }>;
};

export type AuthContext = {
  user: User;
};

export type AdminAuthContext = {
  adminUser: AdminUser;
};

export type WorkspaceContext = {
  workspace: Workspace;
  membership: Membership;
  role: Role;
};
