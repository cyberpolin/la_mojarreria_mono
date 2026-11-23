"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getWorkspaceSession } from "@/lib/taku-api";
import { saveAppSession, type WorkspaceSession } from "@/lib/auth";
import { fetchWhatsAppAccounts } from "./api";
import {
  accountMatchesSlug,
  digitsPhone,
  isFromMojarreriaApp,
  pickMojarreriaAccount,
} from "./helpers";
import { MobileAccountPicker } from "./MobileAccountPicker";
import { MobileConversation } from "./MobileConversation";
import { MobileConversationList } from "./MobileConversationList";
import { MobileAuthGate, MobilePhoneFrame } from "./mobile-shell";
import { useOverdueOwnerAlerts } from "./useOverdueOwnerAlerts";
import { ChecadorFab } from "./ChecadorFab";
import { ChecadorGate } from "./ChecadorGate";
import { DailyCashCloseGate } from "./DailyCashCloseGate";
import { WeeklyReportGate } from "./WeeklyReportGate";
import { WHATSAPP_ACCOUNTS_CHANGED_EVENT } from "./attendance";
import type { InboxWhatsAppAccount } from "./types";

function useAssignedAccounts() {
  const [fromApp, setFromApp] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<InboxWhatsAppAccount[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fromApp = isFromMojarreriaApp();
    setFromApp(fromApp);

    const loadAccounts = () => {
      void fetchWhatsAppAccounts()
        .then((rows) => {
          if (cancelled) return;
          setAccounts(rows);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (cancelled) return;
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudieron cargar los telefonos.",
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    const boot = async () => {
      if (!getWorkspaceSession() && fromApp) {
        try {
          const response = await fetch("/api/kiosk-session", {
            method: "POST",
          });
          const payload = (await response.json()) as {
            ok?: boolean;
            data?: WorkspaceSession;
            error?: { message?: string };
          };
          if (!response.ok || !payload.ok || !payload.data) {
            throw new Error(
              payload.error?.message ?? "No se pudo entrar desde la app.",
            );
          }
          saveAppSession(payload.data);
        } catch (caught) {
          if (cancelled) return;
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo entrar desde la app.",
          );
          setNeedsAuth(true);
          setLoading(false);
          return;
        }
      }

      if (!getWorkspaceSession()) {
        setNeedsAuth(true);
        setLoading(false);
        return;
      }

      setNeedsAuth(false);
      loadAccounts();
      window.addEventListener(WHATSAPP_ACCOUNTS_CHANGED_EVENT, loadAccounts);
    };

    void boot();
    return () => {
      cancelled = true;
      window.removeEventListener(WHATSAPP_ACCOUNTS_CHANGED_EVENT, loadAccounts);
    };
  }, []);

  return { needsAuth, loading, error, accounts, fromApp };
}

function parseMobilePath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[1] ? decodeURIComponent(parts[1]) : "";
  const second = parts[2] ? decodeURIComponent(parts[2]) : "";
  return { first, second };
}

function GateMessage({ children }: { children: string }) {
  return (
    <p id="taku-mobile-content" className="p-4 text-sm text-slate-500">
      {children}
    </p>
  );
}

export function MobileInboxApp() {
  const pathname = usePathname() || "/conversation-mobile";
  const { first, second } = parseMobilePath(pathname);
  const { needsAuth, loading, error, accounts, fromApp } =
    useAssignedAccounts();
  useOverdueOwnerAlerts();

  if (needsAuth && !fromApp) {
    return (
      <MobileAuthGate
        next={
          pathname.startsWith("/conversation-mobile")
            ? pathname
            : "/conversation-mobile"
        }
      />
    );
  }

  const mojarreriaAccount = fromApp ? pickMojarreriaAccount(accounts) : null;
  const selectedAccount = first
    ? (accounts.find((account) => accountMatchesSlug(account, first)) ??
      mojarreriaAccount)
    : mojarreriaAccount;
  const singleAccount = accounts.length === 1 ? accounts[0] : null;
  const listAccount =
    selectedAccount ?? (second ? null : (singleAccount ?? mojarreriaAccount));
  const threadPhone = second
    ? digitsPhone(second)
    : selectedAccount || !first
      ? ""
      : digitsPhone(first);
  const showThread = Boolean(threadPhone);

  return (
    <MobilePhoneFrame>
      <WeeklyReportGate />
      <DailyCashCloseGate />
      <ChecadorGate />
      <ChecadorFab account={listAccount ?? singleAccount} />
      {loading ? <GateMessage>Cargando...</GateMessage> : null}
      {error ? <GateMessage>{error}</GateMessage> : null}
      {!loading && !error && accounts.length === 0 ? (
        <GateMessage>No hay telefonos de WhatsApp asignados.</GateMessage>
      ) : null}
      {!loading && !error && accounts.length > 0 ? (
        listAccount ? (
          <MobileConversationList
            account={listAccount}
            showAccountPicker={accounts.length > 1}
            threadPhone={showThread ? threadPhone : ""}
            threadSlot={
              showThread ? (
                <MobileConversation
                  hideHeader
                  phone={threadPhone}
                  account={listAccount}
                  scoped={accounts.length > 1}
                />
              ) : null
            }
          />
        ) : showThread ? (
          <MobileConversation
            phone={threadPhone}
            account={singleAccount}
            scoped={false}
          />
        ) : (
          <MobileAccountPicker accounts={accounts} />
        )
      ) : null}
    </MobilePhoneFrame>
  );
}
