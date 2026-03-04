type SoldItem = {
  productId: string;
  qty: number;
  price: number;
};

type RecipeItem = {
  productId: string;
  rawMaterialId: string;
  qtyPerProduct: number;
  wastePct: number;
};

type LastUnitCost = {
  rawMaterialId: string;
  unitCostCents: number;
};

type CalcInput = {
  soldItems: SoldItem[];
  recipeItems: RecipeItem[];
  lastUnitCosts: LastUnitCost[];
};

type CostBreakdownMap = Record<string, number>;

type CalcOutput = {
  cogsCents: number;
  breakdown: {
    perProduct: CostBreakdownMap;
    perRawMaterial: CostBreakdownMap;
  };
  warnings: {
    missingRecipe: string[];
    missingLastPrice: string[];
  };
};

const toRoundedCents = (value: number) => Math.round(value);

export const calcDailyCloseCosts = ({
  soldItems,
  recipeItems,
  lastUnitCosts,
}: CalcInput): CalcOutput => {
  const recipesByProduct = new Map<string, RecipeItem[]>();
  for (const recipe of recipeItems) {
    const list = recipesByProduct.get(recipe.productId) ?? [];
    list.push(recipe);
    recipesByProduct.set(recipe.productId, list);
  }

  const lastCostByRawMaterial = new Map<string, number>();
  for (const cost of lastUnitCosts) {
    lastCostByRawMaterial.set(cost.rawMaterialId, cost.unitCostCents);
  }

  const missingRecipe = new Set<string>();
  const missingLastPrice = new Set<string>();

  const perProduct: CostBreakdownMap = {};
  const perRawMaterial: CostBreakdownMap = {};
  let cogsCents = 0;

  for (const sold of soldItems) {
    const productRecipes = recipesByProduct.get(sold.productId);
    if (!productRecipes || productRecipes.length === 0) {
      missingRecipe.add(sold.productId);
      continue;
    }

    for (const recipe of productRecipes) {
      const unitCostCents = lastCostByRawMaterial.get(recipe.rawMaterialId);
      if (unitCostCents === undefined) {
        missingLastPrice.add(recipe.rawMaterialId);
        continue;
      }

      const effectiveQty =
        sold.qty * recipe.qtyPerProduct * (1 + recipe.wastePct / 100);
      const lineCostCents = toRoundedCents(effectiveQty * unitCostCents);
      cogsCents += lineCostCents;

      perProduct[sold.productId] =
        (perProduct[sold.productId] ?? 0) + lineCostCents;
      perRawMaterial[recipe.rawMaterialId] =
        (perRawMaterial[recipe.rawMaterialId] ?? 0) + lineCostCents;
    }
  }

  return {
    cogsCents,
    breakdown: {
      perProduct,
      perRawMaterial,
    },
    warnings: {
      missingRecipe: Array.from(missingRecipe),
      missingLastPrice: Array.from(missingLastPrice),
    },
  };
};
