"use client";

import { useEffect, useState } from "react";

export const INBOX_VIEW_KEY = "MOJARRERIA_TAKU_INBOX_VIEW";
export const INBOX_VIEW_CHANGED_EVENT = "mojarreria-inbox-view-changed";

export type InboxViewRole = "owner" | "agent";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function readInboxView(): InboxViewRole {
  if (!canUseStorage()) return "owner";
  const value = window.localStorage.getItem(INBOX_VIEW_KEY);
  return value === "agent" ? "agent" : "owner";
}

export function setInboxView(view: InboxViewRole) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(INBOX_VIEW_KEY, view);
  window.dispatchEvent(new Event(INBOX_VIEW_CHANGED_EVENT));
}

export function useInboxView() {
  const [view, setView] = useState<InboxViewRole>("owner");

  useEffect(() => {
    const sync = () => setView(readInboxView());
    sync();
    window.addEventListener(INBOX_VIEW_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(INBOX_VIEW_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return view;
}

export function inboxViewMenuItems() {
  const view = readInboxView();
  return [
    {
      label: view === "owner" ? "ver como owner · activa" : "ver como owner",
      onSelect: () => setInboxView("owner"),
    },
    {
      label: view === "agent" ? "ver como agente · activa" : "ver como agente",
      onSelect: () => setInboxView("agent"),
    },
  ];
}
