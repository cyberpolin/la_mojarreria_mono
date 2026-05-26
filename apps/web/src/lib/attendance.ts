import { buildAuthHeaders } from "@/lib/web-auth.server";
import { AttendanceLogRecord, AttendancePayload } from "@/types/attendance";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const ATTENDANCE_QUERY = `
  query AttendanceOverview(
    $deviceId: String!
    $date: String!
    $startDate: String!
    $endDate: String!
  ) {
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
    attendanceLogs(
      where: {
        deviceId: { equals: $deviceId }
        date: { gte: $startDate, lte: $endDate }
      }
      orderBy: [{ date: asc }, { clockInAt: asc }]
    ) {
      id
      date
      deviceId
      clockInAt
      clockOutAt
      durationMinutes
      status
      user {
        id
        name
        phone
      }
    }
  }
`;

const getEndpoint = () =>
  process.env.KEYSTONE_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
  "http://localhost:3000/api/graphql";

export const getAttendanceOverview = async ({
  date,
  startDate = date,
  endDate = date,
  deviceId,
}: {
  date: string;
  startDate?: string;
  endDate?: string;
  deviceId: string;
}): Promise<AttendancePayload> => {
  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
    body: JSON.stringify({
      query: ATTENDANCE_QUERY,
      variables: { date, startDate, endDate, deviceId },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Attendance query failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GraphQLResponse<{
    pendingAttendanceCheckIns: AttendancePayload["pending"];
    attendanceLogs: AttendanceLogRecord[];
  }>;

  if (payload.errors?.length) {
    throw new Error(
      payload.errors[0]?.message ?? "Unknown attendance GraphQL error",
    );
  }

  return {
    date,
    startDate,
    endDate,
    deviceId,
    pending: payload.data?.pendingAttendanceCheckIns ?? [],
    logs: payload.data?.attendanceLogs ?? [],
  };
};
