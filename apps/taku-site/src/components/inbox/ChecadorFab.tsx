"use client";

import { useEffect, useState } from "react";
import { fetchAttendancePunches } from "./api";
import {
  ATTENDANCE_CHANGED_EVENT,
  agentClockFabAction,
  isTimeClockEnabled,
  openChecador,
  readPunches,
  type AttendancePunchRecord,
  type AttendancePunchType,
} from "./attendance";
import { useInboxView } from "./inboxView";
import { todayOrderKey } from "./pendingOrders";
import type { InboxWhatsAppAccount } from "./types";

const POLL_MS = 15_000;

export function ChecadorFab({
  account,
}: {
  account: InboxWhatsAppAccount | null;
}) {
  const view = useInboxView();
  const [punches, setPunches] = useState<AttendancePunchRecord[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!account?.id || !isTimeClockEnabled(account) || view !== "agent") {
      setPunches([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      const local = readPunches().filter(
        (punch) => punch.whatsappAccountId === account.id,
      );
      void fetchAttendancePunches(account.id)
        .then((rows) => {
          if (!cancelled) setPunches(mergePunches(rows, local));
        })
        .catch(() => {
          if (!cancelled) setPunches(local);
        });
    };
    load();
    const poll = window.setInterval(load, POLL_MS);
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, load);
    };
  }, [account?.id, account?.timeClockEnabled, view]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);

  if (view !== "agent" || !account || !isTimeClockEnabled(account)) {
    return null;
  }

  const action = agentClockFabAction({
    punches,
    dayKey: todayOrderKey(now),
    accountId: account.id,
    now,
  });
  if (!action) return null;

  return (
    <button
      type="button"
      onClick={() => openChecador(account)}
      className="absolute bottom-5 left-5 z-20 inline-flex min-h-12 items-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white shadow-lg"
    >
      {fabLabel(action)}
    </button>
  );
}

function fabLabel(action: AttendancePunchType) {
  return action === "entrada" ? "Marcar entrada" : "Marcar salida";
}

function mergePunches(
  remote: AttendancePunchRecord[],
  local: AttendancePunchRecord[],
) {
  const seen = new Set<string>();
  return [...remote, ...local].filter((punch) => {
    if (seen.has(punch.id)) return false;
    seen.add(punch.id);
    return true;
  });
}
