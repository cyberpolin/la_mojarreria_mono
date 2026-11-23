import type { Database } from "../types.js";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function mondayDateKey(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const weekday = WEEKDAY_INDEX[parts.weekday ?? ""] ?? now.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const monday = new Date(
    Date.UTC(year, month - 1, day) - daysSinceMonday * 86_400_000,
  );
  const mondayYear = monday.getUTCFullYear();
  const mondayMonth = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const mondayDay = String(monday.getUTCDate()).padStart(2, "0");
  return `${mondayYear}-${mondayMonth}-${mondayDay}`;
}

export function resetUnreadBadgesIfNeeded(
  database: Database,
  now = new Date(),
) {
  let changed = false;
  for (const workspace of database.workspaces) {
    const weekStart = mondayDateKey(now, workspace.timezone || "UTC");
    if (workspace.unreadWeekStart === weekStart) continue;
    for (const conversation of database.conversations) {
      if (conversation.workspaceId !== workspace.id) continue;
      if (conversation.unreadCount === 0) continue;
      conversation.unreadCount = 0;
      changed = true;
    }
    workspace.unreadWeekStart = weekStart;
    changed = true;
  }
  return changed;
}
