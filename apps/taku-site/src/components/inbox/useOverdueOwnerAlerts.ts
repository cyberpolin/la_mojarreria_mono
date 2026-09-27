"use client";

import { useEffect } from "react";
import { flushOverdueOwnerAlerts } from "./overdueOwnerAlerts";

const TICK_MS = 1000;

export function useOverdueOwnerAlerts() {
  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      void flushOverdueOwnerAlerts();
    };

    tick();
    const intervalId = window.setInterval(tick, TICK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);
}
