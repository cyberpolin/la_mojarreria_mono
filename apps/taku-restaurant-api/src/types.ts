export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "starter" | "business";
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "owner" | "admin" | "agent";
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export type Expense = {
  id: string;
  restaurantId: string;
  date: string;
  concept: string;
  amountCents: number;
  createdAt: string;
};

export type Product = {
  id: string;
  restaurantId: string;
  clientId: string;
  name: string;
  priceCents: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DailyCloseItem = {
  productId: string;
  name: string;
  priceCents: number;
  qty: number;
};

export type DailyCloseEvidence = {
  kind: string;
  takenAt: string;
  url: string;
  publicId: string;
};

export type DailyClose = {
  id: string;
  restaurantId: string;
  deviceId: string;
  date: string;
  items: DailyCloseItem[];
  cashReceived: number;
  bankTransfersReceived: number;
  deliveryCashPaid: number;
  otherCashExpenses: number;
  notes: string;
  closedByUserId: string;
  closedByName: string;
  closedByPhone: string;
  evidence: DailyCloseEvidence[];
  expectedTotal: number;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type RefreshToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export type Database = {
  restaurants: Restaurant[];
  users: User[];
  products: Product[];
  expenses: Expense[];
  dailyCloses: DailyClose[];
  refreshTokens: RefreshToken[];
};

export type AuthContext = {
  user: User;
  restaurant: Restaurant;
};
