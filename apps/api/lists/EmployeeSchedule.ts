import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import {
  checkbox,
  integer,
  json,
  relationship,
  text,
  timestamp,
} from "@keystone-6/core/fields";

export const EmployeeSchedule = list({
  access: allowAll,
  fields: {
    user: relationship({
      ref: "User.schedule",
      many: false,
      ui: {
        displayMode: "select",
        labelField: "name",
      },
    }),
    days: json({
      defaultValue: [],
      ui: { description: 'Array of day labels. Example: ["Mon","Tue"]' },
    }),
    shiftStart: text({
      validation: { isRequired: true },
      defaultValue: "",
      ui: { description: "HH:mm, e.g. 10:00" },
    }),
    shiftEnd: text({
      validation: { isRequired: true },
      defaultValue: "",
      ui: { description: "HH:mm, e.g. 18:00" },
    }),
    breakMinutes: integer({
      defaultValue: 0,
      validation: { isRequired: true },
    }),
    active: checkbox({ defaultValue: true }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
  ui: {
    listView: {
      initialColumns: [
        "user",
        "days",
        "shiftStart",
        "shiftEnd",
        "breakMinutes",
        "active",
      ],
      initialSort: { field: "updatedAt", direction: "DESC" },
    },
  },
});
