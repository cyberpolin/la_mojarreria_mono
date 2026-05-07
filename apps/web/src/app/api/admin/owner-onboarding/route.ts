import { NextRequest, NextResponse } from "next/server";
import { buildAuthHeaders } from "@/lib/web-auth.server";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const getEndpoint = () =>
  process.env.KEYSTONE_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
  "http://localhost:3000/api/graphql";

async function execute<T>(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...buildAuthHeaders() },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok)
    throw new Error(`GraphQL request failed (${response.status})`);
  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors?.length)
    throw new Error(payload.errors[0]?.message ?? "Unknown GraphQL error");
  if (!payload.data) throw new Error("Missing data in GraphQL response");
  return payload.data;
}

const OWNER_QUERY = `
  query AdminUsers {
    users(where: { role: { equals: "OWNER" } }) {
      id
      name
      auth {
        email
      }
    }
  }
`;

const getOwners = async () => {
  const data = await execute<{
    users: Array<{ id: string; name: string; auth?: { email?: string } }>;
  }>(OWNER_QUERY);

  return (
    data.users?.filter((user) => {
      const email = user.auth?.email?.trim() ?? "";
      if (!email) return false;
      return true;
    }) ?? []
  );
};

export async function GET() {
  try {
    const owners = await getOwners();

    return NextResponse.json(
      {
        required: owners.length === 0,
        owners: owners.map((owner) => ({
          id: owner.id,
          name: owner.name,
          email: owner.auth?.email ?? "",
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load owner status",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const owners = await getOwners();
    if (owners.length > 0) {
      return NextResponse.json(
        { error: "Owner already exists." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      name?: string;
      phone?: string;
      email?: string;
      password?: string;
      pin?: string;
      address?: string;
    };

    if (
      !body.name ||
      !body.phone ||
      !body.email ||
      !body.password ||
      !body.pin
    ) {
      return NextResponse.json(
        { error: "name, phone, email, password, and pin are required" },
        { status: 400 },
      );
    }

    const pin = String(body.pin).trim();
    if (pin.length !== 4) {
      return NextResponse.json(
        { error: "pin must be 4 digits" },
        { status: 400 },
      );
    }

    const createUserMutation = `
      mutation CreateUser($data: UserCreateInput!) {
        createUser(data: $data) { id name }
      }
    `;
    const userData = await execute<{
      createUser: { id: string; name: string };
    }>(createUserMutation, {
      data: {
        name: body.name.trim(),
        phone: body.phone.trim(),
        address: body.address?.trim() ?? "",
        role: "OWNER",
        active: true,
      },
    });

    const createAuthMutation = `
      mutation CreateAuth($data: AuthCreateInput!) {
        createAuth(data: $data) { id email }
      }
    `;
    try {
      const authData = await execute<{ createAuth: { email: string } }>(
        createAuthMutation,
        {
          data: {
            email: body.email.trim(),
            password: body.password,
            pin,
            user: { connect: { id: userData.createUser.id } },
          },
        },
      );

      return NextResponse.json(
        {
          owner: {
            id: userData.createUser.id,
            name: userData.createUser.name,
            email: authData.createAuth.email,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      const rollbackMutation = `
        mutation RollbackUser($where: UserWhereUniqueInput!) {
          deleteUser(where: $where) { id }
        }
      `;
      try {
        await execute(rollbackMutation, {
          where: { id: userData.createUser.id },
        });
      } catch {
        // best effort rollback
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create owner",
      },
      { status: 500 },
    );
  }
}
