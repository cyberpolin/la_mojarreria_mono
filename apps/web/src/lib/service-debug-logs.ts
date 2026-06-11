export type ServiceDebugLogName = "wa-service" | "bot-service";

export type ServiceDebugLogEntry = {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error";
  service: ServiceDebugLogName;
  event: string;
  data?: Record<string, unknown>;
};

export function getServiceDebugBaseUrl(service: string): string | null {
  if (service === "wa-service") {
    return (
      process.env.MOJARRERIA_WA_API_BASE_URL ??
      "https://api.wa.lamojarreria.com"
    ).replace(/\/+$/, "");
  }

  if (service === "bot-service") {
    return (
      process.env.MOJARRERIA_BOT_API_BASE_URL ??
      "https://api.bot.lamojarreria.com"
    ).replace(/\/+$/, "");
  }

  return null;
}
