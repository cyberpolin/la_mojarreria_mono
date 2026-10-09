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
  expenses: Expense[];
  refreshTokens: RefreshToken[];
};

export type AuthContext = {
  user: User;
  restaurant: Restaurant;
};
