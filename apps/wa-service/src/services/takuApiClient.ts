import type { Logger } from "pino";
import type { AppConfig } from "../config.js";
import { recordDebugLog } from "./debugLogStore.js";

export type TakuAssignedBot = {
  id: string;
  businessId: string;
  name: string;
  status: "active";
  instructions: string;
  fallbackMessage: string;
};

export type TakuWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type TakuActiveSchedule = {
  days: TakuWeekday[];
  startTime: string;
  endTime: string;
};

export type TakuConnectionRuntime = {
  id: string;
  businessId: string;
  connectionId: string;
  activeSchedule: TakuActiveSchedule | null;
};

export type TakuConnectionBotConfig = {
  bot: TakuAssignedBot | null;
  waConnection: TakuConnectionRuntime | null;
};

type TakuAssignedBotResponse = {
  ok?: boolean;
  waConnection?: TakuConnectionRuntime;
  bot?: TakuAssignedBot | null;
  error?: string;
};

const weekdayByIndex: TakuWeekday[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

function minutesFromTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export function isTakuScheduleActive(
  schedule: TakuActiveSchedule | null,
  now = new Date(),
): boolean {
  if (!schedule) return true;

  const weekday = weekdayByIndex[now.getDay()];
  if (!weekday) return false;
  if (!schedule.days.includes(weekday)) return false;

  const start = minutesFromTime(schedule.startTime);
  const end = minutesFromTime(schedule.endTime);
  if (start === null || end === null) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  if (start <= end) {
    return current >= start && current <= end;
  }

  return current >= start || current <= end;
}

export async function getTakuConnectionBotConfig(params: {
  config: AppConfig;
  logger: Logger;
  connectionId: string;
  businessId: string | null;
}): Promise<TakuConnectionBotConfig | null> {
  if (!params.config.takuApiKey) {
    recordDebugLog({
      level: "warn",
      event: "taku_api_key_missing",
      data: { connectionId: params.connectionId },
    });
    return null;
  }

  const response = await fetch(
    `${params.config.takuApiBaseUrl}/v1/wa-connections/by-connection/${encodeURIComponent(params.connectionId)}/bot`,
    {
      headers: {
        "x-api-key": params.config.takuApiKey,
        "x-taku-role": "client",
        "x-taku-business-id":
          params.businessId ?? params.config.takuApiBusinessId,
      },
    },
  );
  const body = (await response
    .json()
    .catch(() => null)) as TakuAssignedBotResponse | null;

  if (!response.ok || !body?.ok) {
    params.logger.error(
      {
        status: response.status,
        error: body?.error ?? "Missing TAKU API JSON response",
        connectionId: params.connectionId,
      },
      "failed to resolve TAKU assigned bot",
    );
    recordDebugLog({
      level: "error",
      event: "taku_assigned_bot_failed",
      data: {
        status: response.status,
        error: body?.error ?? "Missing TAKU API JSON response",
        connectionId: params.connectionId,
      },
    });
    return null;
  }

  recordDebugLog({
    event: "taku_assigned_bot_resolved",
    data: {
      connectionId: params.connectionId,
      botId: body.bot?.id ?? null,
      botName: body.bot?.name ?? null,
      hasSchedule: Boolean(body.waConnection?.activeSchedule),
    },
  });

  return {
    bot: body.bot ?? null,
    waConnection: body.waConnection ?? null,
  };
}
