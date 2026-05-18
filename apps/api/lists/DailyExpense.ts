import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import { integer, text, timestamp } from "@keystone-6/core/fields";

export const DailyExpense = list({
  access: allowAll,
  fields: {
    date: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "YYYY-MM-DD" },
    }),
    concept: text({
      validation: { isRequired: true },
      isIndexed: true,
    }),
    amountCents: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    notes: text({
      ui: { displayMode: "textarea" },
    }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
  hooks: {
    validateInput: ({ resolvedData, item, addValidationError }) => {
      const amountCents = Number(
        resolvedData.amountCents ?? item?.amountCents ?? 0,
      );
      const concept = String(
        resolvedData.concept ?? item?.concept ?? "",
      ).trim();
      const date = String(resolvedData.date ?? item?.date ?? "").trim();

      if (!date) {
        addValidationError("date is required");
      }

      if (!concept) {
        addValidationError("concept is required");
      }

      if (amountCents <= 0) {
        addValidationError("amountCents must be greater than 0");
      }
    },
  },
  ui: {
    listView: {
      initialColumns: ["date", "concept", "amountCents", "updatedAt"],
      initialSort: { field: "date", direction: "DESC" },
    },
  },
});
