import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import {
  checkbox,
  select,
  text,
  timestamp,
  relationship,
} from "@keystone-6/core/fields";

export const RawMaterial = list({
  access: allowAll,
  fields: {
    name: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    unit: select({
      options: [
        { label: "Kilogram", value: "kg" },
        { label: "Liter", value: "l" },
        { label: "Unit", value: "u" },
      ],
      validation: { isRequired: true },
      defaultValue: "u",
    }),
    active: checkbox({ defaultValue: true }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    purchases: relationship({
      ref: "RawMaterialPurchase.rawMaterial",
      many: true,
    }),
    recipeItems: relationship({
      ref: "ProductRecipeItem.rawMaterial",
      many: true,
    }),
  },
  ui: {
    listView: {
      initialColumns: ["name", "unit", "active", "createdAt"],
    },
  },
});
