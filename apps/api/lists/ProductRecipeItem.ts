import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import { float, integer, relationship } from "@keystone-6/core/fields";

export const ProductRecipeItem = list({
  access: allowAll,
  fields: {
    product: relationship({
      ref: "Product.recipeItems",
      many: false,
      validation: { isRequired: true },
    }),
    rawMaterial: relationship({
      ref: "RawMaterial.recipeItems",
      many: false,
      validation: { isRequired: true },
    }),
    qtyPerProduct: float({
      validation: { isRequired: true },
      defaultValue: 0,
      ui: { description: "Quantity consumed by one sold product (base unit)." },
    }),
    wastePct: integer({
      defaultValue: 0,
      validation: { isRequired: true },
      ui: { description: "Percentage 0..100" },
    }),
  },
  hooks: {
    validateInput: ({ resolvedData, addValidationError }) => {
      const wastePct = Number(resolvedData.wastePct ?? 0);
      if (wastePct < 0 || wastePct > 100) {
        addValidationError("wastePct must be between 0 and 100");
      }
    },
  },
  ui: {
    listView: {
      initialColumns: ["product", "rawMaterial", "qtyPerProduct", "wastePct"],
    },
  },
});
