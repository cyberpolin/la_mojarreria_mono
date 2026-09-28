"use client";

import { useEffect, useState } from "react";
import { WeeklyReportPanel } from "./WeeklyReportPanel";
import {
  WEEKLY_REPORT_OPEN_EVENT,
  ensureWeeklyReport,
  type WeeklyReport,
} from "./weeklyReport";

export function WeeklyReportGate() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const result = ensureWeeklyReport();
    setReport(result.report);
    setSaved(result.saved);

    const onOpen = () => {
      const next = ensureWeeklyReport();
      setReport(next.report);
      setSaved(next.saved);
      setOpen(true);
    };
    window.addEventListener(WEEKLY_REPORT_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(WEEKLY_REPORT_OPEN_EVENT, onOpen);
    };
  }, []);

  if (!open || !report) return null;
  return (
    <WeeklyReportPanel
      report={report}
      saved={saved}
      onClose={() => setOpen(false)}
    />
  );
}
