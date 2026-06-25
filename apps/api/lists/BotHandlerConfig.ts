import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import {
  checkbox,
  json,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

export const BotHandlerConfig = list({
  access: allowAll,
  fields: {
    name: text({
      validation: { isRequired: true },
      isIndexed: true,
    }),
    provider: select({
      options: [
        { label: "WhatsApp", value: "WHATSAPP" },
        { label: "OpenAI", value: "OPENAI" },
        { label: "Custom Webhook", value: "CUSTOM_WEBHOOK" },
      ],
      defaultValue: "CUSTOM_WEBHOOK",
      validation: { isRequired: true },
      ui: { displayMode: "segmented-control" },
    }),
    enabled: checkbox({ defaultValue: false }),
    baseUrl: text({ defaultValue: "" }),
    webhookUrl: text({ defaultValue: "" }),
    apiKeySecret: text({
      defaultValue: "",
      ui: {
        description:
          "Provider API key or secret. Do not expose this value in client queries.",
      },
    }),
    settings: json({ defaultValue: {} }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
  ui: {
    listView: {
      initialColumns: ["name", "provider", "enabled", "updatedAt"],
      initialSort: { field: "updatedAt", direction: "DESC" },
    },
  },
});
