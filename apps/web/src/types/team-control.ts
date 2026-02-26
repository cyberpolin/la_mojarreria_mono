export type TeamRole =
  | "COOK"
  | "ASSISTANT"
  | "DELIVERY"
  | "ADMIN"
  | "AGENT"
  | "CLIENT";

export type TeamEmployeeRecord = {
  id: string;
  name: string;
  phone: string;
  role: TeamRole | null;
  active: boolean;
};

export type TeamAccessRecord = {
  id: string;
  email: string;
  pin: string | null;
  user: {
    id: string;
    name: string;
  } | null;
};

export type TeamScheduleRecord = {
  id: string;
  days: string[];
  shiftStart: string;
  shiftEnd: string;
  breakMinutes: number;
  active: boolean;
  user: {
    id: string;
    name: string;
  } | null;
};

export type TeamControlPayload = {
  employees: TeamEmployeeRecord[];
  accesses: TeamAccessRecord[];
  schedules: TeamScheduleRecord[];
};
