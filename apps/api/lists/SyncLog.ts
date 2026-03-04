import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import {
  integer,
  json,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

export const SyncLog = list({
  access: allowAll,
  fields: {
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      validation: { isRequired: true },
    }),
    type: select({
      options: [
        { label: "Sync Daily Close", value: "SYNC_DAILY_CLOSE" },
        { label: "Sync Other", value: "SYNC_OTHER" },
      ],
      validation: { isRequired: true },
      defaultValue: "SYNC_DAILY_CLOSE",
    }),
    status: select({
      options: [
        { label: "Success", value: "SUCCESS" },
        { label: "Failed", value: "FAILED" },
      ],
      validation: { isRequired: true },
      defaultValue: "FAILED",
    }),
    deviceId: text({
      validation: { isRequired: true },
      isIndexed: true,
    }),
    date: text({
      isIndexed: true,
      ui: { description: "YYYY-MM-DD" },
    }),
    rawId: text(),
    errorMessage: text({
      ui: { displayMode: "textarea" },
    }),
    payloadSnapshot: json(),
    retryCount: integer({
      defaultValue: 0,
      validation: { isRequired: true },
    }),
  },
  ui: {
    listView: {
      initialColumns: [
        "createdAt",
        "status",
        "deviceId",
        "date",
        "errorMessage",
      ],
      initialSort: { field: "createdAt", direction: "DESC" },
    },
  },
});
