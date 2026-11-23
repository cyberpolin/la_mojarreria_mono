"use client";

import { useEffect, useState } from "react";
import { WeeklyReportPanel } from "./WeeklyReportPanel";
import {
  WEEKLY_REPORT_OPEN_EVENT,
  canCloseWeek,
  lastPastWeekStart,
} from "./weeklyReport";

function weekStartFromEvent(event: Event) {
  if (event instanceof CustomEvent) {
    const value = (event.detail as { weekStart?: unknown } | undefined)
      ?.weekStart;
    if (typeof value === "string" && canCloseWeek(value)) return value;
  }
  const fallback = lastPastWeekStart();
  return canCloseWeek(fallback) ? fallback : null;
}

export function WeeklyReportGate() {
  const [weekStart, setWeekStart] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      setWeekStart(weekStartFromEvent(event));
    };
    window.addEventListener(WEEKLY_REPORT_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(WEEKLY_REPORT_OPEN_EVENT, onOpen);
    };
  }, []);

  if (!weekStart) return null;
  return (
    <WeeklyReportPanel
      weekStart={weekStart}
      onClose={() => setWeekStart(null)}
    />
  );
}
