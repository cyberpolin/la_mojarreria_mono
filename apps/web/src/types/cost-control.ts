export type RawMaterialRecord = {
  id: string;
  name: string;
  unit: "kg" | "l" | "u";
  active: boolean;
  createdAt: string | null;
};

export type ProductOption = {
  id: string;
  name: string;
  active?: boolean;
};

export type RawMaterialPurchaseRecord = {
  id: string;
  rawMaterial: {
    id: string;
    name: string;
    unit: "kg" | "l" | "u";
  } | null;
  purchasedAt: string | null;
  quantity: number;
  totalCostCents: number;
  unitCostCents: number;
  supplier: string | null;
  notes: string | null;
};

export type ProductRecipeItemRecord = {
  id: string;
  product: {
    id: string;
    name: string;
  } | null;
  rawMaterial: {
    id: string;
    name: string;
    unit: "kg" | "l" | "u";
  } | null;
  qtyPerProduct: number;
  wastePct: number;
};

export type FixedOperatingExpenseRecord = {
  id: string;
  name: string;
  costCents: number;
  renewalDays: number;
  active: boolean;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CostControlPayload = {
  rawMaterials: RawMaterialRecord[];
  purchases: RawMaterialPurchaseRecord[];
  recipeItems: ProductRecipeItemRecord[];
  fixedExpenses: FixedOperatingExpenseRecord[];
  products: ProductOption[];
};
