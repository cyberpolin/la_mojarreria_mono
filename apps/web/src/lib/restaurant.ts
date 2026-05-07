import { buildAuthHeaders } from "@/lib/web-auth.server";

type RestaurantLogo = {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

export type RestaurantRecord = {
  id: string;
  name: string;
  description?: string | null;
  logo?: RestaurantLogo | null;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const getEndpoint = () =>
  process.env.KEYSTONE_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
  "http://localhost:3000/api/graphql";

const RESTAURANT_QUERY = `
  query LatestRestaurant {
    restaurants(orderBy: [{ createdAt: desc }], take: 1) {
      id
      name
      description
      logo
    }
  }
`;

const CREATE_RESTAURANT_MUTATION = `
  mutation CreateRestaurant($data: RestaurantCreateInput!) {
    createRestaurant(data: $data) {
      id
      name
      description
      logo
    }
  }
`;

const UPDATE_RESTAURANT_MUTATION = `
  mutation UpdateRestaurant($where: RestaurantWhereUniqueInput!, $data: RestaurantUpdateInput!) {
    updateRestaurant(where: $where, data: $data) {
      id
      name
      description
      logo
    }
  }
`;

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

export const getLatestRestaurant = async () => {
  const data = await execute<{ restaurants: RestaurantRecord[] }>(
    RESTAURANT_QUERY,
  );
  return data.restaurants?.[0] ?? null;
};

export const upsertRestaurant = async ({
  id,
  name,
  description,
  logo,
}: {
  id?: string | null;
  name: string;
  description?: string;
  logo?: RestaurantLogo | null;
}) => {
  if (id) {
    const data = await execute<{ updateRestaurant: RestaurantRecord }>(
      UPDATE_RESTAURANT_MUTATION,
      {
        where: { id },
        data: {
          name: name.trim(),
          description: description?.trim() ?? "",
          logo: logo ?? null,
        },
      },
    );
    return data.updateRestaurant;
  }

  const data = await execute<{ createRestaurant: RestaurantRecord }>(
    CREATE_RESTAURANT_MUTATION,
    {
      data: {
        name: name.trim(),
        description: description?.trim() ?? "",
        logo: logo ?? null,
      },
    },
  );

  return data.createRestaurant;
};
