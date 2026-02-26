import {
  TeamAccessRecord,
  TeamControlPayload,
  TeamEmployeeRecord,
  TeamScheduleRecord,
} from "@/types/team-control";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const getCandidateEndpoints = () => {
  const configured =
    process.env.KEYSTONE_GRAPHQL_URL ??
    process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
    "http://localhost:3000/api/graphql";

  const fallback = "http://127.0.0.1:3000/api/graphql";
  return Array.from(new Set([configured, fallback]));
};

async function execute<T>(query: string, variables?: Record<string, unknown>) {
  const endpoints = getCandidateEndpoints();
  const requestBody = JSON.stringify({ query, variables });
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `GraphQL request failed (${response.status}) at ${endpoint}`,
        );
      }

      const payload = (await response.json()) as GraphQLResponse<T>;
      if (payload.errors?.length)
        throw new Error(payload.errors[0]?.message ?? "Unknown GraphQL error");
      if (!payload.data)
        throw new Error(`Missing data in GraphQL response from ${endpoint}`);

      return payload.data;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Unknown fetch error");
    }
  }

  throw new Error(
    `Could not reach Keystone GraphQL. Tried: ${endpoints.join(", ")}. Last error: ${
      lastError?.message ?? "unknown"
    }`,
  );
}

const QUERY = `
  query TeamControlData {
    users(orderBy: [{ name: asc }]) {
      id
      name
      phone
      role
      active
    }
    auths(orderBy: [{ createdAt: desc }], take: 200) {
      id
      email
      pin
      user {
        id
        name
      }
    }
    employeeSchedules(orderBy: [{ updatedAt: desc }], take: 200) {
      id
      days
      shiftStart
      shiftEnd
      breakMinutes
      active
      user {
        id
        name
      }
    }
  }
`;

export const getTeamControlData = async (): Promise<TeamControlPayload> => {
  const data = await execute<{
    users: TeamEmployeeRecord[];
    auths: TeamAccessRecord[];
    employeeSchedules: Array<
      Omit<TeamScheduleRecord, "days"> & { days: unknown }
    >;
  }>(QUERY);

  return {
    employees: data.users ?? [],
    accesses: data.auths ?? [],
    schedules: (data.employeeSchedules ?? []).map((item) => ({
      ...item,
      days: Array.isArray(item.days) ? item.days.map((day) => String(day)) : [],
    })),
  };
};

export const createEmployee = async (input: {
  name: string;
  phone: string;
  role: string;
  active: boolean;
}) => {
  const mutation = `
    mutation CreateUser($data: UserCreateInput!) {
      createUser(data: $data) { id }
    }
  `;
  const data = await execute<{ createUser: { id: string } }>(mutation, {
    data: {
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: input.role,
      active: input.active,
    },
  });
  return data.createUser.id;
};

export const updateEmployee = async (
  id: string,
  input: { name: string; phone: string; role: string; active: boolean },
) => {
  const mutation = `
    mutation UpdateUser($where: UserWhereUniqueInput!, $data: UserUpdateInput!) {
      updateUser(where: $where, data: $data) { id }
    }
  `;
  await execute(mutation, {
    where: { id },
    data: {
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: input.role,
      active: input.active,
    },
  });
};

export const deleteEmployee = async (id: string) => {
  const mutation = `
    mutation DeleteUser($where: UserWhereUniqueInput!) {
      deleteUser(where: $where) { id }
    }
  `;
  await execute(mutation, { where: { id } });
};

export const createAccess = async (input: {
  email: string;
  pin?: string;
  password: string;
  userId: string;
}) => {
  const mutation = `
    mutation CreateAuth($data: AuthCreateInput!) {
      createAuth(data: $data) { id }
    }
  `;
  await execute(mutation, {
    data: {
      email: input.email.trim(),
      password: input.password,
      pin: input.pin?.trim() || null,
      user: { connect: { id: input.userId } },
    },
  });
};

export const updateAccess = async (
  id: string,
  input: { email: string; pin?: string; password?: string; userId: string },
) => {
  const mutation = `
    mutation UpdateAuth($where: AuthWhereUniqueInput!, $data: AuthUpdateInput!) {
      updateAuth(where: $where, data: $data) { id }
    }
  `;
  await execute(mutation, {
    where: { id },
    data: {
      email: input.email.trim(),
      pin: input.pin?.trim() || null,
      ...(input.password ? { password: input.password } : {}),
      user: { connect: { id: input.userId } },
    },
  });
};

export const deleteAccess = async (id: string) => {
  const mutation = `
    mutation DeleteAuth($where: AuthWhereUniqueInput!) {
      deleteAuth(where: $where) { id }
    }
  `;
  await execute(mutation, { where: { id } });
};

export const createSchedule = async (input: {
  userId: string;
  days: string[];
  shiftStart: string;
  shiftEnd: string;
  breakMinutes: number;
  active: boolean;
}) => {
  const mutation = `
    mutation CreateEmployeeSchedule($data: EmployeeScheduleCreateInput!) {
      createEmployeeSchedule(data: $data) { id }
    }
  `;
  await execute(mutation, {
    data: {
      user: { connect: { id: input.userId } },
      days: input.days,
      shiftStart: input.shiftStart,
      shiftEnd: input.shiftEnd,
      breakMinutes: input.breakMinutes,
      active: input.active,
    },
  });
};

export const updateSchedule = async (
  id: string,
  input: {
    userId: string;
    days: string[];
    shiftStart: string;
    shiftEnd: string;
    breakMinutes: number;
    active: boolean;
  },
) => {
  const mutation = `
    mutation UpdateEmployeeSchedule($where: EmployeeScheduleWhereUniqueInput!, $data: EmployeeScheduleUpdateInput!) {
      updateEmployeeSchedule(where: $where, data: $data) { id }
    }
  `;
  await execute(mutation, {
    where: { id },
    data: {
      user: { connect: { id: input.userId } },
      days: input.days,
      shiftStart: input.shiftStart,
      shiftEnd: input.shiftEnd,
      breakMinutes: input.breakMinutes,
      active: input.active,
    },
  });
};

export const deleteSchedule = async (id: string) => {
  const mutation = `
    mutation DeleteEmployeeSchedule($where: EmployeeScheduleWhereUniqueInput!) {
      deleteEmployeeSchedule(where: $where) { id }
    }
  `;
  await execute(mutation, { where: { id } });
};
