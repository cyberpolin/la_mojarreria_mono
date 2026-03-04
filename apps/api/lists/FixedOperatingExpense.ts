import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import { checkbox, integer, text, timestamp } from "@keystone-6/core/fields";

export const FixedOperatingExpense = list({
  access: allowAll,
  fields: {
    name: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    costCents: integer({
      validation: { isRequired: true },
      defaultValue: 0,
      ui: {
        description: "Purchase cost in cents for one replenishment cycle.",
      },
    }),
    renewalDays: integer({
      validation: { isRequired: true },
      defaultValue: 30,
      ui: {
        description:
          "How many days this expense usually lasts before it must be bought again.",
      },
    }),
    active: checkbox({ defaultValue: true }),
    notes: text({
      ui: { displayMode: "textarea" },
    }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
  hooks: {
    validateInput: ({ resolvedData, item, addValidationError }) => {
      const renewalDays = Number(
        resolvedData.renewalDays ?? item?.renewalDays ?? 0,
      );
      const costCents = Number(resolvedData.costCents ?? item?.costCents ?? 0);

      if (renewalDays <= 0) {
        addValidationError("renewalDays must be greater than 0");
      }

      if (costCents < 0) {
        addValidationError("costCents cannot be negative");
      }
    },
  },
  ui: {
    listView: {
      initialColumns: [
        "name",
        "costCents",
        "renewalDays",
        "active",
        "updatedAt",
      ],
      initialSort: { field: "name", direction: "ASC" },
    },
  },
});
