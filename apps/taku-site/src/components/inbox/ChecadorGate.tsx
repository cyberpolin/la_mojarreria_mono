"use client";

import { useEffect, useState } from "react";
import { CHECADOR_OPEN_EVENT } from "./attendance";
import { ChecadorPanel } from "./ChecadorPanel";
import type { InboxWhatsAppAccount } from "./types";

function accountFromEvent(event: Event) {
  if (!(event instanceof CustomEvent)) return null;
  const value = (event.detail as { account?: InboxWhatsAppAccount } | undefined)
    ?.account;
  return value?.id ? value : null;
}

export function ChecadorGate() {
  const [account, setAccount] = useState<InboxWhatsAppAccount | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      setAccount(accountFromEvent(event));
    };
    window.addEventListener(CHECADOR_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(CHECADOR_OPEN_EVENT, onOpen);
    };
  }, []);

  if (!account) return null;
  return <ChecadorPanel account={account} onClose={() => setAccount(null)} />;
}
