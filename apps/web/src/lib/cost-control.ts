import {
  CostControlPayload,
  ProductOption,
  ProductRecipeItemRecord,
  RawMaterialPurchaseRecord,
  RawMaterialRecord,
} from "@/types/cost-control";

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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok)
    throw new Error(`GraphQL request failed (${response.status})`);

  const payload = (await response.json()) as GraphQLResponse<T>;
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Unknown GraphQL error");
  }
  if (!payload.data) throw new Error("Missing data in GraphQL response");
  return payload.data;
}

const COST_CONTROL_QUERY = `
  query CostControlData {
    rawMaterials(orderBy: [{ name: asc }]) {
      id
      name
      unit
      active
      createdAt
    }
    rawMaterialPurchases(orderBy: [{ purchasedAt: desc }], take: 200) {
      id
      purchasedAt
      quantity
      totalCostCents
      unitCostCents
      supplier
      notes
      rawMaterial {
        id
        name
        unit
      }
    }
    productRecipeItems(take: 300) {
      id
      qtyPerProduct
      wastePct
      product {
        id
        name
      }
      rawMaterial {
        id
        name
        unit
      }
    }
    products(orderBy: [{ name: asc }]) {
      id
      name
      active
    }
  }
`;

export const getCostControlData = async (): Promise<CostControlPayload> => {
  const data = await execute<{
    rawMaterials: RawMaterialRecord[];
    rawMaterialPurchases: RawMaterialPurchaseRecord[];
    productRecipeItems: ProductRecipeItemRecord[];
    products: ProductOption[];
  }>(COST_CONTROL_QUERY);

  return {
    rawMaterials: data.rawMaterials ?? [],
    purchases: data.rawMaterialPurchases ?? [],
    recipeItems: data.productRecipeItems ?? [],
    products: data.products ?? [],
  };
};

export const createRawMaterial = async (input: {
  name: string;
  unit: "kg" | "l" | "u";
  active?: boolean;
}) => {
  const mutation = `
    mutation CreateRawMaterial($data: RawMaterialCreateInput!) {
      createRawMaterial(data: $data) { id }
    }
  `;
  await execute(mutation, {
    data: {
      name: input.name.trim(),
      unit: input.unit,
      active: input.active ?? true,
    },
  });
};

export const updateRawMaterial = async (
  id: string,
  input: { name: string; unit: "kg" | "l" | "u"; active: boolean },
) => {
  const mutation = `
    mutation UpdateRawMaterial($where: RawMaterialWhereUniqueInput!, $data: RawMaterialUpdateInput!) {
      updateRawMaterial(where: $where, data: $data) { id }
    }
  `;
  await execute(mutation, {
    where: { id },
    data: {
      name: input.name.trim(),
      unit: input.unit,
      active: input.active,
    },
  });
};

export const deleteRawMaterial = async (id: string) => {
  const mutation = `
    mutation DeleteRawMaterial($where: RawMaterialWhereUniqueInput!) {
      deleteRawMaterial(where: $where) { id }
    }
  `;
  await execute(mutation, { where: { id } });
};

export const createPurchase = async (input: {
  rawMaterialId: string;
  purchasedAt?: string;
  quantity: number;
  totalCostCents: number;
  supplier?: string;
  notes?: string;
}) => {
  const mutation = `
    mutation CreateRawMaterialPurchase($data: RawMaterialPurchaseCreateInput!) {
      createRawMaterialPurchase(data: $data) { id }
    }
  `;
  await execute(mutation, {
    data: {
      rawMaterial: { connect: { id: input.rawMaterialId } },
      purchasedAt: input.purchasedAt || null,
      quantity: input.quantity,
      totalCostCents: input.totalCostCents,
      supplier: input.supplier?.trim() || "",
      notes: input.notes?.trim() || "",
    },
  });
};

export const updatePurchase = async (
  id: string,
  input: {
    rawMaterialId: string;
    purchasedAt?: string;
    quantity: number;
    totalCostCents: number;
    supplier?: string;
    notes?: string;
  },
) => {
  const mutation = `
    mutation UpdateRawMaterialPurchase(
      $where: RawMaterialPurchaseWhereUniqueInput!
      $data: RawMaterialPurchaseUpdateInput!
    ) {
      updateRawMaterialPurchase(where: $where, data: $data) { id }
    }
  `;
  await execute(mutation, {
    where: { id },
    data: {
      rawMaterial: { connect: { id: input.rawMaterialId } },
      purchasedAt: input.purchasedAt || null,
      quantity: input.quantity,
      totalCostCents: input.totalCostCents,
      supplier: input.supplier?.trim() || "",
      notes: input.notes?.trim() || "",
    },
  });
};

export const deletePurchase = async (id: string) => {
  const mutation = `
    mutation DeleteRawMaterialPurchase($where: RawMaterialPurchaseWhereUniqueInput!) {
      deleteRawMaterialPurchase(where: $where) { id }
    }
  `;
  await execute(mutation, { where: { id } });
};

export const createRecipeItem = async (input: {
  productId: string;
  rawMaterialId: string;
  qtyPerProduct: number;
  wastePct: number;
}) => {
  const mutation = `
    mutation CreateProductRecipeItem($data: ProductRecipeItemCreateInput!) {
      createProductRecipeItem(data: $data) { id }
    }
  `;
  await execute(mutation, {
    data: {
      product: { connect: { id: input.productId } },
      rawMaterial: { connect: { id: input.rawMaterialId } },
      qtyPerProduct: input.qtyPerProduct,
      wastePct: input.wastePct,
    },
  });
};

export const updateRecipeItem = async (
  id: string,
  input: {
    productId: string;
    rawMaterialId: string;
    qtyPerProduct: number;
    wastePct: number;
  },
) => {
  const mutation = `
    mutation UpdateProductRecipeItem(
      $where: ProductRecipeItemWhereUniqueInput!
      $data: ProductRecipeItemUpdateInput!
    ) {
      updateProductRecipeItem(where: $where, data: $data) { id }
    }
  `;
  await execute(mutation, {
    where: { id },
    data: {
      product: { connect: { id: input.productId } },
      rawMaterial: { connect: { id: input.rawMaterialId } },
      qtyPerProduct: input.qtyPerProduct,
      wastePct: input.wastePct,
    },
  });
};

export const deleteRecipeItem = async (id: string) => {
  const mutation = `
    mutation DeleteProductRecipeItem($where: ProductRecipeItemWhereUniqueInput!) {
      deleteProductRecipeItem(where: $where) { id }
    }
  `;
  await execute(mutation, { where: { id } });
};
