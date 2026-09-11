"use client";

import { useEffect, useState } from "react";
import { getWorkspaceSession } from "@/lib/taku-api";
import { fetchWhatsAppAccounts } from "./api";
import { accountMatchesSlug } from "./helpers";
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

function GateFrame({ children }: { children: string }) {
  return (
    <MobilePhoneFrame>
      <p className="p-4 text-sm text-slate-500">{children}</p>
    </MobilePhoneFrame>
  );
}

export function MobileInboxHome() {
  const { needsAuth, loading, error, accounts } = useAssignedAccounts();
  if (needsAuth) return <MobileAuthGate next="/conversation-mobile" />;
  if (loading) return <GateFrame>Cargando telefonos...</GateFrame>;
  if (error) return <GateFrame>{error}</GateFrame>;
  if (accounts.length === 0) {
    return <GateFrame>No hay telefonos de WhatsApp asignados.</GateFrame>;
  }
  if (accounts.length === 1) {
    return <MobileConversationList account={accounts[0]} />;
  }
  return <MobileAccountPicker accounts={accounts} />;
}

export function MobileInboxPhoneSegment({ phone }: { phone: string }) {
  const { needsAuth, loading, error, accounts } = useAssignedAccounts();
  if (needsAuth) {
    return <MobileAuthGate next={`/conversation-mobile/${phone}`} />;
  }
  if (loading) return <GateFrame>Cargando...</GateFrame>;
  if (error) return <GateFrame>{error}</GateFrame>;

  const selected = accounts.find((account) =>
    accountMatchesSlug(account, phone),
  );
  if (accounts.length > 1 && selected) {
    return <MobileConversationList account={selected} showAccountPicker />;
  }
  return <MobileConversation phone={phone} />;
}

export function MobileInboxThread({
  accountSlug,
  contactPhone,
}: {
  accountSlug: string;
  contactPhone: string;
}) {
  const { needsAuth, loading, error, accounts } = useAssignedAccounts();
  if (needsAuth) {
    return (
      <MobileAuthGate
        next={`/conversation-mobile/${accountSlug}/${contactPhone}`}
      />
    );
  }
  if (loading) return <GateFrame>Cargando...</GateFrame>;
  if (error) return <GateFrame>{error}</GateFrame>;

  const selected =
    accounts.find((account) => accountMatchesSlug(account, accountSlug)) ??
    null;
  return <MobileConversation phone={contactPhone} account={selected} scoped />;
}
