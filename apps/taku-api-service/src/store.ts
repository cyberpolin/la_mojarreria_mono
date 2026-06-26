import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type BusinessStatus = "active" | "trial" | "suspended";
export type MemberRole = "superowner" | "owner" | "operator";
export type WaConnectionState =
  | "inactive"
  | "starting"
  | "qr_pending"
  | "connected"
  | "error";
export type BotStatus = "draft" | "active" | "paused";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type ActiveSchedule = {
  days: Weekday[];
  startTime: string;
  endTime: string;
};

export type Business = {
  id: string;
  name: string;
  ownerName: string;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
};

export type BusinessMember = {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: MemberRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WaConnection = {
  id: string;
  businessId: string;
  connectionId: string;
  name: string;
  description: string;
  phone: string | null;
  state: WaConnectionState;
  activeSchedule: ActiveSchedule | null;
  createdAt: string;
  updatedAt: string;
};

export type Bot = {
  id: string;
  businessId: string;
  name: string;
  status: BotStatus;
  instructions: string;
  fallbackMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type BotPhoneAssignment = {
  id: string;
  businessId: string;
  botId: string;
  waConnectionId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaymentProvider = "mock" | "mercadopago";

export type PaymentRecord = {
  id: string;
  businessId: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  providerPreferenceId: string | null;
  status: string;
  amount: number | null;
  currency: string | null;
  paidAt: string | null;
  rawProviderStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TakuData = {
  businesses: Business[];
  members: BusinessMember[];
  waConnections: WaConnection[];
  bots: Bot[];
  assignments: BotPhoneAssignment[];
  payments: PaymentRecord[];
};

let writeQueue = Promise.resolve();

function nowIso(): string {
  return new Date().toISOString();
}

function emptyData(): TakuData {
  return {
    businesses: [],
    members: [],
    waConnections: [],
    bots: [],
    assignments: [],
    payments: [],
  };
}

async function readData(filePath: string): Promise<TakuData> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as Partial<TakuData>;

    return {
      businesses: Array.isArray(parsed.businesses) ? parsed.businesses : [],
      members: Array.isArray(parsed.members) ? parsed.members : [],
      waConnections: Array.isArray(parsed.waConnections)
        ? parsed.waConnections
        : [],
      bots: Array.isArray(parsed.bots) ? parsed.bots : [],
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyData();
    }

    throw error;
  }
}

async function writeData(filePath: string, data: TakuData): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );

  return next;
}

export class TakuStore {
  constructor(private readonly filePath: string) {}

  async list(): Promise<TakuData> {
    return readData(this.filePath);
  }

  async mutate<T>(operation: (data: TakuData) => T): Promise<T> {
    return enqueueWrite(async () => {
      const data = await readData(this.filePath);
      const result = operation(data);
      await writeData(this.filePath, data);
      return result;
    });
  }
}

export async function ensureSuperownerMember(params: {
  filePath: string;
  email: string;
}): Promise<BusinessMember> {
  const email = params.email.toLowerCase();

  return enqueueWrite(async () => {
    const data = await readData(params.filePath);
    const existing = data.members.find(
      (member) => member.email.toLowerCase() === email,
    );

    if (existing) {
      existing.name = existing.name || "TAKU Superowner";
      existing.email = email;
      existing.role = "superowner";
      existing.active = true;
      touch(existing);
      await writeData(params.filePath, data);
      return existing;
    }

    const member: BusinessMember = {
      id: createId("member"),
      businessId: "platform",
      name: "TAKU Superowner",
      email,
      role: "superowner",
      active: true,
      ...timestamps(),
    };
    data.members.push(member);
    await writeData(params.filePath, data);
    return member;
  });
}

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function touch<T extends { updatedAt: string }>(record: T): T {
  record.updatedAt = nowIso();
  return record;
}

export function timestamps() {
  const now = nowIso();
  return { createdAt: now, updatedAt: now };
}
