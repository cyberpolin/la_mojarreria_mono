"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { takuApi } from "@/lib/taku-api";
import { AutoRepliesPanel } from "@/components/inbox/AutoRepliesPanel";
import { NumberBreadcrumb } from "../../../NumberBreadcrumb";
import { OwnerShell } from "../../../OwnerShell";
import type { OwnerWhatsAppAccount } from "../../../NumberForms";

export default function OwnerNumberAutoRepliesPage() {
  const params = useParams();
  const accountId = String(params.accountId ?? "");
  const [account, setAccount] = useState<OwnerWhatsAppAccount | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      const loaded = await takuApi<OwnerWhatsAppAccount>(
        `/whatsapp-accounts/${accountId}`,
      );
      setAccount(loaded);
    } catch {
      setAccount(null);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <OwnerShell headerLabel="Informacion general">
      {() => (
        <div className="grid gap-6">
          <NumberBreadcrumb
            accountId={accountId}
            accountName={account?.displayName}
            current="Respuestas automaticas"
          />
          {accountId ? <AutoRepliesPanel accountId={accountId} /> : null}
        </div>
      )}
    </OwnerShell>
  );
}
