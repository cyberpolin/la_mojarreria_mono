"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { takuApi } from "@/lib/taku-api";
import { NumberBreadcrumb } from "../../NumberBreadcrumb";
import { NumberForms, type OwnerWhatsAppAccount } from "../../NumberForms";
import { NumberSectionCards } from "../../NumberSectionCards";
import { OwnerShell } from "../../OwnerShell";
import type { OwnerBotSettings, OwnerBusinessHours } from "../../numberTypes";

export default function OwnerNumberFormsPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = String(params.accountId ?? "");
  const [account, setAccount] = useState<OwnerWhatsAppAccount | null>(null);
  const [settings, setSettings] = useState<OwnerBotSettings | null>(null);
  const [hours, setHours] = useState<OwnerBusinessHours | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    if (!accountId) return;
    try {
      const loaded = await takuApi<OwnerWhatsAppAccount>(
        `/whatsapp-accounts/${accountId}`,
      );
      setAccount(loaded);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cargar el numero.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    setIsLoading(true);
    void loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const query = `whatsappAccountId=${encodeURIComponent(accountId)}`;
    void Promise.allSettled([
      takuApi<OwnerBotSettings>(`/bot-settings?${query}`),
      takuApi<OwnerBusinessHours>(`/business-hours?${query}`),
    ]).then(([settingsResult, hoursResult]) => {
      if (cancelled) return;
      setSettings(
        settingsResult.status === "fulfilled" ? settingsResult.value : null,
      );
      setHours(hoursResult.status === "fulfilled" ? hoursResult.value : null);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return (
    <OwnerShell headerLabel="Informacion general">
      {() => (
        <div className="grid gap-6">
          <NumberBreadcrumb
            accountId={accountId}
            accountName={account?.displayName}
          />

          {error ? (
            <div className="rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-700">
              {error}
            </div>
          ) : null}
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-700">
              Cargando numero...
            </div>
          ) : account ? (
            <>
              <NumberSectionCards
                settings={settings}
                hours={hours}
                onOpenAutomation={() =>
                  router.push(`/owner/numbers/${accountId}/automation`)
                }
                onOpenHours={() =>
                  router.push(`/owner/numbers/${accountId}/hours`)
                }
              />
              <NumberForms account={account} onAccountChange={loadAccount} />
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
              No se encontro el numero.
            </div>
          )}
        </div>
      )}
    </OwnerShell>
  );
}
