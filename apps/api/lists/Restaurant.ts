import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import { json, text, timestamp } from "@keystone-6/core/fields";

export const Restaurant = list({
  access: allowAll,
  fields: {
    name: text({ validation: { isRequired: true } }),
    description: text({
      ui: { displayMode: "textarea" },
    }),
    logo: json({
      ui: {
        description:
          "Logo image metadata (publicId, secureUrl, width, height, format, bytes).",
      },
    }),
    createdAt: timestamp({ defaultValue: { kind: "now" } }),
    updatedAt: timestamp({ db: { updatedAt: true } }),
  },
  ui: {
    listView: {
      initialColumns: ["name", "createdAt", "updatedAt"],
    },
  },
});
