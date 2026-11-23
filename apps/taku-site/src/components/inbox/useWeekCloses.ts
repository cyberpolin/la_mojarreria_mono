"use client";

import { useEffect, useState } from "react";
import { fetchWeekCloses, type WeekCloseRecord } from "./api";
import { WEEK_CLOSES_CHANGED_EVENT } from "./weekCosts";

export function useWeekCloses() {
  const [closes, setCloses] = useState<Record<string, WeekCloseRecord>>({});

  useEffect(() => {
    const sync = () => {
      void fetchWeekCloses()
        .then((rows) => {
          const next: Record<string, WeekCloseRecord> = {};
          for (const row of rows) next[row.weekStart] = row;
          setCloses(next);
        })
        .catch(() => undefined);
    };
    sync();
    window.addEventListener(WEEK_CLOSES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(WEEK_CLOSES_CHANGED_EVENT, sync);
  }, []);

  return closes;
}
