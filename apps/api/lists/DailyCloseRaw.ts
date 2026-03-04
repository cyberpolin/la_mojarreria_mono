// /src/schema/DailyCloseRaw.ts
import { list } from "@keystone-6/core";
import { allowAll } from "@keystone-6/core/access";
import {
  text,
  timestamp,
  json,
  select,
  relationship,
} from "@keystone-6/core/fields";

// Si tienes session/auth, aquí podrías usar access control.
// Por ahora lo dejo simple.
export const DailyCloseRaw = list({
  fields: {
    // Recomendación: si es 1 tablet por negocio, deviceId te ayuda a evitar choques
    deviceId: text({
      validation: { isRequired: true },
      defaultValue: "kiosk-001", // puedes quitarlo si siempre lo mandas desde app
      isIndexed: true,
    }),

    // La fecha del cierre (clave lógica)
    date: text({
      validation: { isRequired: true },
      isIndexed: true,
      ui: { description: "YYYY-MM-DD" },
    }),

    // Payload crudo de la app (tal cual)
    payload: json({
      ui: {
        description: "DailyClose tal cual llega desde la app (centavos int).",
      },
    }),

    // Estado de procesamiento del BE (opcional pero MUY útil)
    status: select({
      options: [
        { label: "Received", value: "RECEIVED" },
        { label: "Processed", value: "PROCESSED" },
        { label: "Failed", value: "FAILED" },
      ],
      defaultValue: "RECEIVED",
      validation: { isRequired: true },
    }),

    // Metadatos server-side
    receivedAt: timestamp({
      defaultValue: { kind: "now" },
      validation: { isRequired: true },
    }),
    notes: text({
      ui: { displayMode: "textarea" },
      db: { isNullable: false },
    }),
    processedAt: timestamp(),
    errorMessage: text({
      ui: { displayMode: "textarea" },
      db: { isNullable: true },
    }),
    // inside DailyCloseRaw fields:
    normalizedClose: relationship({
      ref: "DailyClose.sourceRaw",
      many: false,
    }),
  },

  ui: {
    listView: {
      initialColumns: [
        "deviceId",
        "date",
        "status",
        "receivedAt",
        "processedAt",
      ],
      initialSort: { field: "date", direction: "DESC" },
    },
  },
  access: allowAll,
});
