import { ProductCreateInput, ProductRecord } from "@/types/product";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

const getEndpoint = () =>
  process.env.KEYSTONE_GRAPHQL_URL ??
  process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
  "http://localhost:3000/api/graphql";

const PRODUCTS_QUERY = `
  query Products {
    products(orderBy: [{ name: asc }]) {
      id
      name
      price
      rawCost
      salePrice
      active
      description
      images
    }
  }
`;

const CREATE_PRODUCT_MUTATION = `
  mutation CreateProduct($data: ProductCreateInput!) {
    createProduct(data: $data) {
      id
      name
      price
      rawCost
      salePrice
      active
      description
      images
    }
  }
`;

async function execute<T>(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export const getProducts = async () => {
  const data = await execute<{ products: ProductRecord[] }>(PRODUCTS_QUERY);
  return data.products ?? [];
};

export const createProduct = async (input: ProductCreateInput) => {
  const data = await execute<{ createProduct: ProductRecord }>(
    CREATE_PRODUCT_MUTATION,
    {
      data: {
        name: input.name.trim(),
        price: input.price,
        rawCost: input.rawCost,
        salePrice: input.salePrice ?? null,
        description: input.description?.trim() || "",
        active: input.active ?? true,
        timeProcess: "30",
        images: input.images,
      },
    },
  );

  return data.createProduct;
};
