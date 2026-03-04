// /schemas/DailyCloseItem.ts
// (comment) full path: schemas/DailyCloseItem.ts

import { list } from "@keystone-6/core";
import { relationship, text, integer } from "@keystone-6/core/fields";
import { allowAll } from "@keystone-6/core/access";

export const DailyCloseItem = list({
  access: allowAll,

  fields: {
    close: relationship({
      ref: "DailyClose.items",
      many: false,
      validation: { isRequired: true },
    }),

    productId: text({ validation: { isRequired: true } }),
    name: text({ validation: { isRequired: true } }),

    // cents
    price: integer({ validation: { isRequired: true } }),
    qty: integer({ validation: { isRequired: true } }),

    // cents (qty*price), filled by processor
    subtotal: integer({ validation: { isRequired: true }, defaultValue: 0 }),
  },

  ui: {
    listView: {
      initialColumns: [
        "close",
        "productId",
        "name",
        "qty",
        "price",
        "subtotal",
      ],
    },
  },
});
