"use client";

import { useEffect, useState } from "react";
import { DailyCashClosePanel } from "./DailyCashClosePanel";
import { DAILY_CASH_CLOSE_OPEN_EVENT, canCloseDay } from "./dayClose";

function dayKeyFromEvent(event: Event) {
  if (!(event instanceof CustomEvent)) return null;
  const value = (event.detail as { dayKey?: unknown } | undefined)?.dayKey;
  return typeof value === "string" && canCloseDay(value) ? value : null;
}

export function DailyCashCloseGate() {
  const [dayKey, setDayKey] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      setDayKey(dayKeyFromEvent(event));
    };
    window.addEventListener(DAILY_CASH_CLOSE_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(DAILY_CASH_CLOSE_OPEN_EVENT, onOpen);
    };
  }, []);

  if (!dayKey) return null;
  return (
    <DailyCashClosePanel dayKey={dayKey} onClose={() => setDayKey(null)} />
  );
}
