"use client";

import { useEffect } from "react";
import { closeDueOrders } from "./pendingOrders";

const TICK_MS = 1000;

export function useSystemOrderClose() {
  useEffect(() => {
    const tick = () => {
      closeDueOrders();
    };
    tick();
    const intervalId = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(intervalId);
  }, []);
}
