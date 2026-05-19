import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApolloClient, gql, NormalizedCacheObject } from "@apollo/client";
import dayjs from "dayjs";
import { APP_CONFIG } from "@/constants/config";

const STORAGE_KEY = "MOJARRERIA_ATTENDANCE_V1";

export type AttendanceEmployee = {
  userId: string;
  name: string;
  phone: string;
  role: string | null;
  pin: string;
  deviceId: string;
  active: boolean;
  schedule: {
    days: unknown;
    shiftStart: string;
    shiftEnd: string;
    breakMinutes: number;
    active: boolean;
  } | null;
  cachedAt: string;
};

export type EmployeeClockRecord = {
  status: "IN" | "OUT";
  date: string | null;
  clockInTime: string | null;
  lastClockOutTime: string | null;
  lastShiftDurationMinutes: number | null;
  employeeName: string;
  employeePhone: string;
};

export type AttendanceAction = "CHECK_IN" | "CHECK_OUT";

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

type AttendanceOutboxJob = {
  mutationId: string;
  userId: string;
  deviceId: string;
  action: AttendanceAction;
  occurredAt: string;
  date: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};

type AttendancePayload = {
  version: 1;
  updatedAt: string;
  employees: AttendanceEmployee[];
  records: Record<string, EmployeeClockRecord>;
  outbox: AttendanceOutboxJob[];
};

const DEFAULT_PAYLOAD: AttendancePayload = {
  version: 1,
  updatedAt: "",
  employees: [],
  records: {},
  outbox: [],
};

const ATTENDANCE_EMPLOYEES = gql`
  query AttendanceEmployees($deviceId: String!) {
    attendanceEmployees(deviceId: $deviceId) {
      userId
      name
      phone
      role
      pin
      deviceId
      active
      schedule {
        days
        shiftStart
        shiftEnd
        breakMinutes
        active
      }
    }
  }
`;

const VALIDATE_ATTENDANCE_EMPLOYEE = gql`
  mutation ValidateAttendanceEmployee(
    $deviceId: String!
    $phone: String!
    $pin: String!
  ) {
    validateAttendanceEmployee(deviceId: $deviceId, phone: $phone, pin: $pin) {
      success
      message
      employee {
        userId
        name
        phone
        role
        pin
        deviceId
        active
        schedule {
          days
          shiftStart
          shiftEnd
          breakMinutes
          active
        }
      }
      openLog {
        date
        clockInAt
        status
      }
    }
  }
`;

const RECORD_ATTENDANCE_EVENT = gql`
  mutation RecordAttendanceEvent(
    $deviceId: String!
    $userId: String!
    $action: String!
    $occurredAt: String!
    $date: String!
    $mutationId: String!
  ) {
    recordAttendanceEvent(
      deviceId: $deviceId
      userId: $userId
      action: $action
      occurredAt: $occurredAt
      date: $date
      mutationId: $mutationId
    ) {
      success
      message
      pendingPreviousCheckout
      log {
        date
        clockInAt
        clockOutAt
        durationMinutes
        status
      }
    }
  }
`;

const PENDING_ATTENDANCE_CHECK_INS = gql`
  query PendingAttendanceCheckIns($deviceId: String!, $date: String!) {
    pendingAttendanceCheckIns(deviceId: $deviceId, date: $date) {
      userId
      name
      phone
      role
      deviceId
      shiftStart
      shiftEnd
      breakMinutes
    }
  }
`;

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const normalizeDayToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const dayAliasesByIndex = [
  ["sun", "sunday", "domingo", "dom"],
  ["mon", "monday", "lunes", "lun"],
  ["tue", "tuesday", "martes", "mar"],
  ["wed", "wednesday", "miercoles", "mie"],
  ["thu", "thursday", "jueves", "jue"],
  ["fri", "friday", "viernes", "vie"],
  ["sat", "saturday", "sabado", "sab"],
];

const isAllowedToday = (employee: AttendanceEmployee) => {
  if (!employee.schedule?.active) return false;
  const days = Array.isArray(employee.schedule.days)
    ? employee.schedule.days
    : [];
  if (days.length === 0) return true;
  const todayAliases =
    dayAliasesByIndex[new Date().getDay()].map(normalizeDayToken);
  return days.some((day) =>
    todayAliases.includes(normalizeDayToken(String(day))),
  );
};

const defaultRecord = (
  employee?: Pick<AttendanceEmployee, "name" | "phone">,
): EmployeeClockRecord => ({
  status: "OUT",
  date: null,
  clockInTime: null,
  lastClockOutTime: null,
  lastShiftDurationMinutes: null,
  employeeName: employee?.name ?? "",
  employeePhone: employee?.phone ?? "",
});

const readPayload = async (): Promise<AttendancePayload> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PAYLOAD;

  try {
    const parsed = JSON.parse(raw) as Partial<AttendancePayload>;
    if (!parsed || typeof parsed !== "object") return DEFAULT_PAYLOAD;

    return {
      version: 1,
      updatedAt: String(parsed.updatedAt ?? ""),
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      records: (parsed.records ?? {}) as Record<string, EmployeeClockRecord>,
      outbox: Array.isArray(parsed.outbox) ? parsed.outbox : [],
    };
  } catch {
    return DEFAULT_PAYLOAD;
  }
};

const writePayload = async (payload: AttendancePayload) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const saveEmployees = async (employees: AttendanceEmployee[]) => {
  const payload = await readPayload();
  await writePayload({
    ...payload,
    updatedAt: new Date().toISOString(),
    employees,
  });
};

const upsertEmployee = async (employee: AttendanceEmployee) => {
  const payload = await readPayload();
  const employees = payload.employees.filter(
    (item) => item.userId !== employee.userId,
  );
  employees.push(employee);
  await writePayload({
    ...payload,
    updatedAt: new Date().toISOString(),
    employees,
  });
};

export const getAllClockRecords = async () => {
  const payload = await readPayload();
  return payload.records;
};

export const getClockRecordByUserId = async (
  userId: string,
): Promise<EmployeeClockRecord> => {
  const records = await getAllClockRecords();
  return records[userId] ?? defaultRecord();
};

export const getAttendanceOutboxCount = async () => {
  const payload = await readPayload();
  return payload.outbox.length;
};

export const getCachedAttendanceEmployees = async () => {
  const payload = await readPayload();
  return payload.employees.filter(
    (employee) => employee.active && employee.deviceId === APP_CONFIG.deviceId,
  );
};

export const syncAttendanceEmployees = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
) => {
  const fetchedAt = new Date().toISOString();
  const response = await apolloClient.query<{
    attendanceEmployees: Array<Omit<AttendanceEmployee, "cachedAt">>;
  }>({
    query: ATTENDANCE_EMPLOYEES,
    variables: { deviceId: APP_CONFIG.deviceId },
    fetchPolicy: "network-only",
  });

  const employees = (response.data?.attendanceEmployees ?? []).map((item) => ({
    userId: String(item.userId),
    name: String(item.name),
    phone: String(item.phone),
    role: item.role ?? null,
    pin: String(item.pin),
    deviceId: String(item.deviceId),
    active: Boolean(item.active),
    schedule: item.schedule ?? null,
    cachedAt: fetchedAt,
  }));

  await saveEmployees(employees);
  return employees;
};

export const findCachedAttendanceEmployee = async (
  phone: string,
  pin: string,
) => {
  const employees = await getCachedAttendanceEmployees();
  const normalizedPhone = normalizePhone(phone);
  return (
    employees.find(
      (employee) =>
        normalizePhone(employee.phone) === normalizedPhone &&
        employee.pin === pin &&
        isAllowedToday(employee),
    ) ?? null
  );
};

export const validateAttendanceEmployee = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  phone: string,
  pin: string,
) => {
  const response = await apolloClient.mutate<{
    validateAttendanceEmployee: {
      success: boolean;
      message: string;
      employee: Omit<AttendanceEmployee, "cachedAt"> | null;
      openLog: {
        date: string;
        clockInAt: string | null;
        status: string;
      } | null;
    };
  }>({
    mutation: VALIDATE_ATTENDANCE_EMPLOYEE,
    variables: {
      deviceId: APP_CONFIG.deviceId,
      phone: phone.trim(),
      pin: pin.trim(),
    },
    fetchPolicy: "no-cache",
  });

  console.log("validateAttendanceEmployee response:", response);
  const result = response.data?.validateAttendanceEmployee;
  if (!result?.success || !result.employee) {
    return {
      success: false,
      message: result?.message ?? "No se pudo validar el empleado.",
      employee: null,
      openLog: null,
    };
  }

  const employee: AttendanceEmployee = {
    ...result.employee,
    cachedAt: new Date().toISOString(),
  };
  await upsertEmployee(employee);

  if (result.openLog?.status === "OPEN" && result.openLog.clockInAt) {
    await upsertClockRecordByUserId(employee.userId, {
      status: "IN",
      date: result.openLog.date,
      clockInTime: result.openLog.clockInAt,
      lastClockOutTime: null,
      lastShiftDurationMinutes: null,
      employeeName: employee.name,
      employeePhone: employee.phone,
    });
  }

  return {
    success: true,
    message: result.message,
    employee,
    openLog: result.openLog,
  };
};

export const upsertClockRecordByUserId = async (
  userId: string,
  record: EmployeeClockRecord,
) => {
  const payload = await readPayload();
  const next: AttendancePayload = {
    ...payload,
    updatedAt: new Date().toISOString(),
    records: {
      ...payload.records,
      [userId]: record,
    },
  };

  await writePayload(next);
  return next.records;
};

export const recordLocalAttendanceEvent = async (
  employee: AttendanceEmployee,
  action: AttendanceAction,
) => {
  const payload = await readPayload();
  const nowIso = new Date().toISOString();
  const date = dayjs(nowIso).format("YYYY-MM-DD");
  const current = payload.records[employee.userId] ?? defaultRecord(employee);
  const mutationId = `${APP_CONFIG.deviceId}:${employee.userId}:${action}:${Date.now()}`;

  const durationMinutes =
    action === "CHECK_OUT" && current.clockInTime
      ? Math.max(0, dayjs(nowIso).diff(dayjs(current.clockInTime), "minute"))
      : null;

  const nextRecord: EmployeeClockRecord =
    action === "CHECK_IN"
      ? {
          status: "IN",
          date,
          clockInTime: nowIso,
          lastClockOutTime: current.lastClockOutTime,
          lastShiftDurationMinutes: current.lastShiftDurationMinutes,
          employeeName: employee.name,
          employeePhone: employee.phone,
        }
      : {
          status: "OUT",
          date: current.date,
          clockInTime: null,
          lastClockOutTime: nowIso,
          lastShiftDurationMinutes: durationMinutes ?? 0,
          employeeName: employee.name,
          employeePhone: employee.phone,
        };

  const nextPayload: AttendancePayload = {
    ...payload,
    updatedAt: nowIso,
    records: {
      ...payload.records,
      [employee.userId]: nextRecord,
    },
    outbox: [
      ...payload.outbox,
      {
        mutationId,
        userId: employee.userId,
        deviceId: APP_CONFIG.deviceId,
        action,
        occurredAt: nowIso,
        date: action === "CHECK_OUT" && current.date ? current.date : date,
        createdAt: nowIso,
        attempts: 0,
        lastError: null,
      },
    ],
  };

  await writePayload(nextPayload);
  return {
    record: nextRecord,
    mutationId,
    occurredAt: nowIso,
    durationMinutes,
  };
};

export const syncAttendanceOutbox = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
) => {
  const payload = await readPayload();
  const remaining: AttendanceOutboxJob[] = [];

  for (const job of payload.outbox) {
    try {
      const response = await apolloClient.mutate<{
        recordAttendanceEvent: {
          success: boolean;
          message: string;
          pendingPreviousCheckout: boolean;
        };
      }>({
        mutation: RECORD_ATTENDANCE_EVENT,
        variables: {
          deviceId: job.deviceId,
          userId: job.userId,
          action: job.action,
          occurredAt: job.occurredAt,
          date: job.date,
          mutationId: job.mutationId,
        },
        fetchPolicy: "no-cache",
      });

      const result = response.data?.recordAttendanceEvent;
      if (!result?.success) {
        remaining.push({
          ...job,
          attempts: job.attempts + 1,
          lastError: result?.message ?? "Sync failed.",
        });
      }
    } catch (error) {
      remaining.push({
        ...job,
        attempts: job.attempts + 1,
        lastError: error instanceof Error ? error.message : "Sync failed.",
      });
    }
  }

  await writePayload({
    ...payload,
    updatedAt: new Date().toISOString(),
    outbox: remaining,
  });

  return {
    synced: payload.outbox.length - remaining.length,
    pending: remaining.length,
  };
};

export const fetchPendingAttendanceCheckIns = async (
  apolloClient: ApolloClient<NormalizedCacheObject>,
  date: string,
) => {
  const response = await apolloClient.query<{
    pendingAttendanceCheckIns: PendingAttendanceCheckIn[];
  }>({
    query: PENDING_ATTENDANCE_CHECK_INS,
    variables: {
      deviceId: APP_CONFIG.deviceId,
      date,
    },
    fetchPolicy: "network-only",
  });

  return response.data?.pendingAttendanceCheckIns ?? [];
};
