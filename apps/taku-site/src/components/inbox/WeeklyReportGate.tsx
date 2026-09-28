"use client";

import { useEffect, useState } from "react";
import { WeeklyReportPanel } from "./WeeklyReportPanel";
import {
  WEEKLY_REPORT_OPEN_EVENT,
  currentWeekStart,
  ensureWeeklyReport,
} from "./weeklyReport";

function weekStartFromEvent(event: Event) {
  if (!(event instanceof CustomEvent)) return currentWeekStart();
  const value = (event.detail as { weekStart?: unknown } | undefined)
    ?.weekStart;
  return typeof value === "string" && value ? value : currentWeekStart();
}

export function WeeklyReportGate() {
  const [weekStart, setWeekStart] = useState<string | null>(null);

  useEffect(() => {
    const result = ensureWeeklyReport();
    const onOpen = (event: Event) => {
      setWeekStart(weekStartFromEvent(event));
    };
    window.addEventListener(WEEKLY_REPORT_OPEN_EVENT, onOpen);
    if (result.justGenerated) {
      setWeekStart(result.report.weekStart);
    }
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
