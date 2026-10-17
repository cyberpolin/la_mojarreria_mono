"use client";

import { useEffect, useState } from "react";
import { getWorkspaceSession } from "@/lib/taku-api";

export const INBOX_VIEW_KEY = "MOJARRERIA_TAKU_INBOX_VIEW";
export const INBOX_VIEW_CHANGED_EVENT = "mojarreria-inbox-view-changed";

export type InboxViewRole = "owner" | "agent";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function isMobileInboxPath(pathname?: string | null) {
  return Boolean(pathname?.startsWith("/conversation-mobile"));
}

const TABLET_KIOSK_EMAIL = (
  process.env.NEXT_PUBLIC_TAKU_KIOSK_EMAIL ?? "tablet@table.com"
).toLowerCase();

export function sessionInboxRole(): InboxViewRole {
  const session = getWorkspaceSession();
  const role = session?.currentWorkspace.role ?? session?.role;
  return role === "agent" ? "agent" : "owner";
}

export function isTabletKioskSession() {
  const email = getWorkspaceSession()?.user.email?.trim().toLowerCase();
  return email === TABLET_KIOSK_EMAIL;
}

export function canSwitchInboxView() {
  return !isTabletKioskSession();
}

export function readStoredInboxView(): InboxViewRole {
  if (!canUseStorage()) return "owner";
  const value = window.localStorage.getItem(INBOX_VIEW_KEY);
  return value === "agent" ? "agent" : "owner";
}

export function readInboxView(): InboxViewRole {
  if (!canSwitchInboxView()) return sessionInboxRole();
  return readStoredInboxView();
}

export function setInboxView(view: InboxViewRole) {
  if (!canUseStorage() || !canSwitchInboxView()) return;
  window.localStorage.setItem(INBOX_VIEW_KEY, view);
  window.dispatchEvent(new Event(INBOX_VIEW_CHANGED_EVENT));
}

export function useInboxView() {
  const [view, setView] = useState<InboxViewRole>(() =>
    typeof window === "undefined" ? "owner" : readInboxView(),
  );

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

export function canSendWeAreOpen() {
  const session = getWorkspaceSession();
  const role = session?.currentWorkspace.role ?? session?.role;
  return role === "owner" || role === "admin";
}

export function inboxViewMenuItems() {
  if (!canSwitchInboxView()) return [];
  const view = readStoredInboxView();
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

export function weAreOpenMenuItems(onSelect: () => void) {
  if (!canSendWeAreOpen() || readInboxView() !== "owner") return [];
  return [
    {
      label: "Avisar que estamos abiertos",
      onSelect,
    },
  ];
}
