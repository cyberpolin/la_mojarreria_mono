import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import {
  integer,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

export const AttendanceLog = list({
  access: allowAll,
  fields: {
    user: relationship({
      ref: "User.attendanceLogs",
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
    date: text({
      validation: { isRequired: true },
      isIndexed: true,
      defaultValue: "",
    }),
    clockInAt: timestamp(),
    clockOutAt: timestamp(),
    durationMinutes: integer({ defaultValue: 0 }),
    status: select({
      options: [
        { label: "Open", value: "OPEN" },
        { label: "Closed", value: "CLOSED" },
        { label: "Needs Review", value: "NEEDS_REVIEW" },
      ],
      defaultValue: "OPEN",
      validation: { isRequired: true },
      ui: { displayMode: "segmented-control" },
    }),
    source: text({ defaultValue: "mobile" }),
    checkInMutationId: text({
      validation: { isRequired: true },
      isIndexed: "unique",
      defaultValue: "",
    }),
    checkOutMutationId: text({
      db: { isNullable: true },
      isIndexed: "unique",
    }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
  ui: {
    listView: {
      initialColumns: [
        "user",
        "deviceId",
        "date",
        "status",
        "clockInAt",
        "clockOutAt",
      ],
      initialSort: { field: "updatedAt", direction: "DESC" },
    },
  },
});
