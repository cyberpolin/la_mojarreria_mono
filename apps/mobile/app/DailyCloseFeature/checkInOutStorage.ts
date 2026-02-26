import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "MOJARRERIA_CHECK_IN_OUT_V1";

type EmployeeClockRecord = {
  status: "IN" | "OUT";
  clockInTime: string | null;
  lastClockOutTime: string | null;
  lastShiftDurationMinutes: number | null;
};

type CheckInOutPayload = {
  version: 1;
  updatedAt: string;
  records: Record<string, EmployeeClockRecord>;
};

const DEFAULT_PAYLOAD: CheckInOutPayload = {
  version: 1,
  updatedAt: "",
  records: {},
};

const readPayload = async (): Promise<CheckInOutPayload> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PAYLOAD;

  try {
    const parsed = JSON.parse(raw) as Partial<CheckInOutPayload>;
    if (!parsed || typeof parsed !== "object") return DEFAULT_PAYLOAD;

    return {
      version: 1,
      updatedAt: String(parsed.updatedAt ?? ""),
      records: (parsed.records ?? {}) as Record<string, EmployeeClockRecord>,
    };
  } catch {
    return DEFAULT_PAYLOAD;
  }
};

const writePayload = async (payload: CheckInOutPayload) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const getAllClockRecords = async () => {
  const payload = await readPayload();
  return payload.records;
};

export const getClockRecordByUserId = async (
  userId: string,
): Promise<EmployeeClockRecord> => {
  const records = await getAllClockRecords();
  return (
    records[userId] ?? {
      status: "OUT",
      clockInTime: null,
      lastClockOutTime: null,
      lastShiftDurationMinutes: null,
    }
  );
};

export const upsertClockRecordByUserId = async (
  userId: string,
  record: EmployeeClockRecord,
) => {
  const payload = await readPayload();
  const next: CheckInOutPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    records: {
      ...payload.records,
      [userId]: record,
    },
  };

  await writePayload(next);
  return next.records;
};
