export type PendingAttendanceCheckIn = {
  userId: string;
  name: string;
  phone: string;
  role: string | null;
  deviceId: string;
  shiftStart: string;
  shiftEnd: string;
  breakMinutes: number;
};

export type AttendanceLogRecord = {
  id: string;
  date: string;
  deviceId: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  durationMinutes: number;
  status: "OPEN" | "CLOSED" | "NEEDS_REVIEW" | string;
  user: {
    id: string;
    name: string;
    phone: string;
  } | null;
};

export type AttendancePayload = {
  date: string;
  deviceId: string;
  pending: PendingAttendanceCheckIn[];
  logs: AttendanceLogRecord[];
};
