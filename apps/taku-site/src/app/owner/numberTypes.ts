export type OwnerBotSettings = {
  enabled: boolean;
  afterHoursEnabled: boolean;
  afterHoursResponder?: "static_message" | "assigned_bot" | "none";
  afterHoursMessage: string | null;
  rulesEnabled: boolean;
  aiEnabled: boolean;
};

export type OwnerHoursDay = {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};

export type OwnerBusinessHours = {
  timezone?: string;
  days: OwnerHoursDay[];
};

export const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
];

export function afterHoursLabel(settings: OwnerBotSettings) {
  if (!settings.afterHoursEnabled) return "";
  if (settings.afterHoursResponder === "assigned_bot") return "Bot asignado";
  if (settings.afterHoursResponder === "none") return "Sin respuesta";
  return "Mensaje fijo";
}
