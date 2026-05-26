import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import {
  checkbox,
  json,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

export const WaServiceStatus = list({
  access: allowAll,
  fields: {
    service: text({
      validation: { isRequired: true },
      isIndexed: true,
      defaultValue: "wa-service",
    }),
    instanceId: text({
      validation: { isRequired: true },
      isIndexed: true,
      defaultValue: "default",
    }),
    state: select({
      options: [
        { label: "Inactive", value: "INACTIVE" },
        { label: "Starting", value: "STARTING" },
        { label: "Active", value: "ACTIVE" },
        { label: "Stopping", value: "STOPPING" },
        { label: "Error", value: "ERROR" },
      ],
      defaultValue: "INACTIVE",
      validation: { isRequired: true },
      ui: { displayMode: "segmented-control" },
    }),
    active: checkbox({ defaultValue: false }),
    connected: checkbox({ defaultValue: false }),
    reason: text({ defaultValue: "" }),
    lastChangedAt: timestamp(),
    payload: json(),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
  ui: {
    listView: {
      initialColumns: [
        "service",
        "instanceId",
        "state",
        "active",
        "connected",
        "lastChangedAt",
      ],
      initialSort: { field: "updatedAt", direction: "DESC" },
    },
  },
});
