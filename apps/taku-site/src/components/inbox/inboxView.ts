"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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

function currentPathname() {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

export function sessionInboxRole(): InboxViewRole {
  const session = getWorkspaceSession();
  const role = session?.currentWorkspace.role ?? session?.role;
  return role === "agent" ? "agent" : "owner";
}

export function readStoredInboxView(): InboxViewRole {
  if (!canUseStorage()) return "owner";
  const value = window.localStorage.getItem(INBOX_VIEW_KEY);
  return value === "agent" ? "agent" : "owner";
}

export function readInboxView(pathname?: string | null): InboxViewRole {
  if (isMobileInboxPath(pathname ?? currentPathname())) {
    return sessionInboxRole();
  }
  return readStoredInboxView();
}

export function setInboxView(view: InboxViewRole) {
  if (!canUseStorage()) return;
  if (isMobileInboxPath(currentPathname())) return;
  window.localStorage.setItem(INBOX_VIEW_KEY, view);
  window.dispatchEvent(new Event(INBOX_VIEW_CHANGED_EVENT));
}

export function useInboxView() {
  const pathname = usePathname();
  const [stored, setStored] = useState<InboxViewRole>("owner");

  useEffect(() => {
    const sync = () => setStored(readStoredInboxView());
    sync();
    window.addEventListener(INBOX_VIEW_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(INBOX_VIEW_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (isMobileInboxPath(pathname)) return sessionInboxRole();
  return stored;
}

export function canSendWeAreOpen() {
  const session = getWorkspaceSession();
  const role = session?.currentWorkspace.role ?? session?.role;
  return role === "owner" || role === "admin";
}

export function inboxViewMenuItems() {
  if (isMobileInboxPath(currentPathname())) return [];
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
  if (!canSendWeAreOpen()) return [];
  if (!isMobileInboxPath(currentPathname()) && readInboxView() !== "owner") {
    return [];
  }
  return [
    {
      label: "Avisar que estamos abiertos",
      onSelect,
    },
  ];
}
