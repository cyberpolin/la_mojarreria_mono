// /schemas/DailyClose.ts
// (comment) full path: schemas/DailyClose.ts

import { list } from "@keystone-6/core";
import {
  relationship,
  text,
  timestamp,
  select,
  integer,
  json,
} from "@keystone-6/core/fields";
import { allowAll } from "@keystone-6/core/access";

export const DailyClose = list({
  access: allowAll,

  fields: {
    deviceId: text({
      validation: { isRequired: true },
      isIndexed: "unique",
    }),

    date: text({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: { description: "YYYY-MM-DD" },
    }),
    // Normalized totals (centavos)
    cashReceived: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    bankTransfersReceived: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    deliveryCashPaid: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    otherCashExpenses: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),

    expectedTotal: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),

    // Useful derived total (computed in processor)
    totalFromItems: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    cogsCents: integer({ validation: { isRequired: true }, defaultValue: 0 }),
    grossProfitCents: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    grossMarginBps: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    allocatedFixedExpensesCents: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    fixedExpenseRatioBps: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    operatingProfitCents: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    operatingMarginBps: integer({
      validation: { isRequired: true },
      defaultValue: 0,
    }),
    costingWarnings: json(),
    costingStatus: select({
      options: [
        { label: "Pending", value: "PENDING" },
        { label: "Complete", value: "COMPLETE" },
        { label: "Partial", value: "PARTIAL" },
      ],
      defaultValue: "PENDING",
      validation: { isRequired: true },
      ui: { displayMode: "segmented-control" },
    }),

    notes: text({ ui: { displayMode: "textarea" } }),

    // Optional state machine
    status: select({
      validation: { isRequired: true },
      defaultValue: "ACTIVE",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Voided", value: "VOIDED" },
      ],
      ui: { displayMode: "segmented-control" },
    }),

    // Relations
    items: relationship({ ref: "DailyCloseItem.close", many: true }),

    // Link to raw record that originated this close
    sourceRaw: relationship({
      ref: "DailyCloseRaw.normalizedClose",
      many: false,
    }),
    closedBy: relationship({ ref: "User.dailyCloses", many: false }),

    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },

  ui: {
    listView: {
      initialColumns: [
        "deviceId",
        "date",
        "totalFromItems",
        "closedBy",
        "cogsCents",
        "allocatedFixedExpensesCents",
        "grossProfitCents",
        "operatingProfitCents",
        "costingStatus",
        "status",
        "updatedAt",
      ],
      initialSort: { field: "date", direction: "DESC" },
    },
  },

  // ⚠️ Unique index for upsert: needs Prisma @@unique([deviceId, date])
  // Keystone list config may not support compound unique in your version; do it in Prisma (recommended).
});
