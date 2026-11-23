"use client";

import { useEffect, useState } from "react";
import { fetchDayCloses, type DayCloseRecord } from "./api";

export const DAY_CLOSES_CHANGED_EVENT = "mojarreria-day-closes-changed";

export function notifyDayClosesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DAY_CLOSES_CHANGED_EVENT));
}

export function useDayCloses() {
  const [closes, setCloses] = useState<Record<string, DayCloseRecord>>({});

  useEffect(() => {
    const sync = () => {
      void fetchDayCloses()
        .then((rows) => {
          const next: Record<string, DayCloseRecord> = {};
          for (const row of rows) next[row.dayKey] = row;
          setCloses(next);
        })
        .catch(() => undefined);
    };
    sync();
    window.addEventListener(DAY_CLOSES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DAY_CLOSES_CHANGED_EVENT, sync);
  }, []);

  return closes;
}
