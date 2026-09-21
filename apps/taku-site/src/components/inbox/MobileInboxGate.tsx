"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getWorkspaceSession } from "@/lib/taku-api";
import { fetchWhatsAppAccounts } from "./api";
import { accountMatchesSlug, digitsPhone } from "./helpers";
import { MobileAccountPicker } from "./MobileAccountPicker";
import { MobileConversation } from "./MobileConversation";
import { MobileConversationList } from "./MobileConversationList";
import { MobileAuthGate, MobilePhoneFrame } from "./mobile-shell";
import type { InboxWhatsAppAccount } from "./types";

function useAssignedAccounts() {
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<InboxWhatsAppAccount[]>([]);

  useEffect(() => {
    if (!getWorkspaceSession()) {
      setNeedsAuth(true);
      setLoading(false);
      return;
    }
    setNeedsAuth(false);
    void fetchWhatsAppAccounts()
      .then((rows) => {
        setAccounts(rows);
        setError(null);
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cargar los telefonos.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { needsAuth, loading, error, accounts };
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
  const { needsAuth, loading, error, accounts } = useAssignedAccounts();

  if (needsAuth) {
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

  const selectedAccount = first
    ? (accounts.find((account) => accountMatchesSlug(account, first)) ?? null)
    : null;
  const singleAccount = accounts.length === 1 ? accounts[0] : null;
  const listAccount = selectedAccount ?? (second ? null : singleAccount);
  const threadPhone = second
    ? digitsPhone(second)
    : selectedAccount || !first
      ? ""
      : digitsPhone(first);
  const showThread = Boolean(threadPhone);

  return (
    <MobilePhoneFrame>
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
