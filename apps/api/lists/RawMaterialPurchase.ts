import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import {
  float,
  integer,
  relationship,
  text,
  timestamp,
} from "@keystone-6/core/fields";

export const RawMaterialPurchase = list({
  access: allowAll,
  fields: {
    rawMaterial: relationship({
      ref: "RawMaterial.purchases",
      many: false,
      validation: { isRequired: true },
    }),
    purchasedAt: timestamp({
      defaultValue: { kind: "now" },
      validation: { isRequired: true },
    }),
    quantity: float({
      validation: { isRequired: true },
      defaultValue: 0,
      ui: { description: "Base unit quantity (kg/l/u) using decimal values." },
    }),
    totalCostCents: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    unitCostCents: integer({
      validation: { isRequired: true },
      defaultValue: 0,
      ui: { description: "Computed from totalCostCents / quantity (rounded)." },
    }),
    supplier: text(),
    notes: text({
      ui: { displayMode: "textarea" },
    }),
  },
  hooks: {
    resolveInput: async ({ resolvedData, item }) => {
      const quantity = Number(resolvedData.quantity ?? item?.quantity ?? 0);
      const totalCostCents = Number(
        resolvedData.totalCostCents ?? item?.totalCostCents ?? 0,
      );
      const computedUnitCostCents =
        quantity > 0 ? Math.round(totalCostCents / quantity) : 0;
      return {
        ...resolvedData,
        unitCostCents: computedUnitCostCents,
      };
    },
  },
  ui: {
    listView: {
      initialColumns: [
        "rawMaterial",
        "purchasedAt",
        "unitCostCents",
        "quantity",
        "totalCostCents",
      ],
      initialSort: { field: "purchasedAt", direction: "DESC" },
    },
  },
});
