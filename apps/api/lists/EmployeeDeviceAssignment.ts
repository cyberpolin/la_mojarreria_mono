import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import {
  checkbox,
  relationship,
  text,
  timestamp,
} from "@keystone-6/core/fields";

export const EmployeeDeviceAssignment = list({
  access: allowAll,
  fields: {
    user: relationship({
      ref: "User.deviceAssignment",
      many: false,
      ui: {
        displayMode: "select",
        labelField: "name",
      },
    }),
    deviceId: text({
      validation: { isRequired: true },
      isIndexed: true,
      defaultValue: "",
    }),
    active: checkbox({ defaultValue: true }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
  ui: {
    listView: {
      initialColumns: ["user", "deviceId", "active", "updatedAt"],
      initialSort: { field: "updatedAt", direction: "DESC" },
    },
  },
});
