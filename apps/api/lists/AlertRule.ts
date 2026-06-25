import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import {
  checkbox,
  integer,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

export const AlertRule = list({
  access: allowAll,
  fields: {
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
    }),
    metric: select({
      options: [{ label: "Low Mojarras", value: "LOW_MOJARRAS" }],
      defaultValue: "LOW_MOJARRAS",
      validation: { isRequired: true },
      ui: { displayMode: "segmented-control" },
    }),
    enabled: checkbox({ defaultValue: true }),
    threshold: integer({
      validation: { isRequired: true },
      defaultValue: 10,
    }),
    recipient: text({
      validation: { isRequired: true },
      ui: {
        description: "Phone, chat id, or destination expected by handler.",
      },
    }),
    messageTemplate: text({
      defaultValue:
        "Alert: Mojarras inventory is at {remaining}. Threshold is {threshold}.",
      ui: { displayMode: "textarea" },
    }),
    botHandlerId: text({
      validation: { isRequired: true },
      ui: { description: "BotHandlerConfig id used to deliver the alert." },
    }),
    cooldownMinutes: integer({
      validation: { isRequired: true },
      defaultValue: 240,
    }),
    lastTriggeredAt: timestamp(),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
  ui: {
    listView: {
      initialColumns: [
        "name",
        "metric",
        "enabled",
        "threshold",
        "recipient",
        "updatedAt",
      ],
      initialSort: { field: "updatedAt", direction: "DESC" },
    },
  },
});
