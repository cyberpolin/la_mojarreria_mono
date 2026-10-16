import type {
  AutomationDecisionLog,
  BusinessHour,
  Conversation,
  Message,
} from "../types.js";

export const WE_ARE_OPEN_REASON = "we_are_open";
export const WE_ARE_OPEN_MESSAGE =
  "Hola, gracias por escribirnos, ya estamos en servicio!! Recuerda que abrimos de Viernes a Domingo, de 11am a 5pm";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function hoursForAccount(
  hours: BusinessHour[],
  workspaceId: string,
  whatsappAccountId: string,
) {
  const accountHours = hours.filter(
    (item) =>
      item.workspaceId === workspaceId &&
      item.whatsappAccountId === whatsappAccountId,
  );
  return accountHours.length
    ? accountHours
    : hours.filter(
        (item) => item.workspaceId === workspaceId && !item.whatsappAccountId,
      );
}

export function zonedWeekdayAndMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return {
    dayOfWeek: WEEKDAY_INDEX[weekday] ?? date.getDay(),
    minutes:
      Number.isFinite(hour) && Number.isFinite(minute)
        ? hour * 60 + minute
        : date.getHours() * 60 + date.getMinutes(),
  };
}

function timeToMinutes(value: string | null | undefined) {
  if (!value) return null;
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

export function isBusinessOpenAt(
  hours: BusinessHour[],
  date: Date,
  timeZone: string,
) {
  if (!hours.length) return true;
  const { dayOfWeek, minutes } = zonedWeekdayAndMinutes(date, timeZone);
  const today = hours.find((item) => item.dayOfWeek === dayOfWeek);
  if (!today) return true;
  if (today.isClosed) return false;
  const opensAt = timeToMinutes(today.opensAt);
  const closesAt = timeToMinutes(today.closesAt);
  if (opensAt === null || closesAt === null) return true;
  return minutes >= opensAt && minutes < closesAt;
}

export function lastReasonAt(
  logs: Array<
    Pick<AutomationDecisionLog, "conversationId" | "reason" | "createdAt">
  >,
  conversationId: string,
  reason: string,
) {
  return (
    logs
      .filter(
        (log) => log.conversationId === conversationId && log.reason === reason,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
      ?.createdAt ?? null
  );
}

export function conversationWroteWhileClosed(params: {
  conversation: Pick<Conversation, "id">;
  messages: Array<
    Pick<Message, "conversationId" | "direction" | "status" | "createdAt">
  >;
  logs: Array<
    Pick<AutomationDecisionLog, "conversationId" | "reason" | "createdAt">
  >;
  hours: BusinessHour[];
  timeZone: string;
}) {
  const since =
    lastReasonAt(params.logs, params.conversation.id, WE_ARE_OPEN_REASON) ?? "";
  const closedInbound = params.messages
    .filter(
      (message) =>
        message.conversationId === params.conversation.id &&
        message.direction === "inbound" &&
        message.createdAt > since &&
        !isBusinessOpenAt(
          params.hours,
          new Date(message.createdAt),
          params.timeZone,
        ),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const latestClosed = closedInbound[0];
  const afterHoursAt =
    params.logs
      .filter(
        (log) =>
          log.conversationId === params.conversation.id &&
          log.reason === "after_hours" &&
          log.createdAt > since,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
      ?.createdAt ?? null;
  if (!latestClosed && !afterHoursAt) return false;
  const closedAt = latestClosed?.createdAt ?? afterHoursAt ?? since;
  const answeredByHuman = params.messages.some(
    (message) =>
      message.conversationId === params.conversation.id &&
      message.direction === "outbound" &&
      message.status !== "failed" &&
      message.createdAt > closedAt,
  );
  return !answeredByHuman;
}
