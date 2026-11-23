"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { takuApi } from "@/lib/taku-api";
import { Button, Input, Switch } from "@/components/inbox/ui";
import { NumberBreadcrumb } from "../../../NumberBreadcrumb";
import { OwnerShell } from "../../../OwnerShell";
import type { OwnerWhatsAppAccount } from "../../../NumberForms";
import {
  DAY_NAMES,
  type OwnerBusinessHours,
  type OwnerHoursDay,
} from "../../../numberTypes";

function emptyDays(): OwnerHoursDay[] {
  return DAY_NAMES.map((_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: false,
    opensAt: "09:00",
    closesAt: "18:00",
  }));
}

export default function OwnerNumberHoursPage() {
  const params = useParams();
  const accountId = String(params.accountId ?? "");
  const [account, setAccount] = useState<OwnerWhatsAppAccount | null>(null);
  const [days, setDays] = useState<OwnerHoursDay[]>(emptyDays);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      const [loadedAccount, hours] = await Promise.all([
        takuApi<OwnerWhatsAppAccount>(`/whatsapp-accounts/${accountId}`),
        takuApi<OwnerBusinessHours>(
          `/business-hours?whatsappAccountId=${encodeURIComponent(accountId)}`,
        ),
      ]);
      setAccount(loadedAccount);
      setDays(
        emptyDays().map((day) => {
          const found = hours.days.find(
            (item) => item.dayOfWeek === day.dayOfWeek,
          );
          return {
            dayOfWeek: day.dayOfWeek,
            isClosed: found?.isClosed ?? false,
            opensAt: found?.opensAt ?? "09:00",
            closesAt: found?.closesAt ?? "18:00",
          };
        }),
      );
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cargar el horario.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    setIsLoading(true);
    void load();
  }, [load]);

  async function save() {
    setIsSaving(true);
    setMessage(null);
    try {
      await takuApi("/business-hours", {
        method: "PUT",
        body: JSON.stringify({ whatsappAccountId: accountId, days }),
      });
      setMessage("Horario guardado.");
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el horario.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <OwnerShell headerLabel="Informacion general">
      {() => (
        <div className="grid gap-6">
          <NumberBreadcrumb
            accountId={accountId}
            accountName={account?.displayName}
            current="Horario"
          />
          {error ? (
            <div className="rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-700">
              {error}
            </div>
          ) : null}
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-700">
              Cargando horario...
            </div>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Horario
                </p>
                <Button disabled={isSaving} onClick={() => void save()}>
                  {isSaving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
              {message ? (
                <div className="border-b border-slate-200 px-5 py-3 text-sm text-slate-700 md:px-6">
                  {message}
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Dia</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Apertura</th>
                      <th className="px-4 py-3">Cierre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {days.map((day) => (
                      <tr key={day.dayOfWeek}>
                        <td className="px-4 py-3 font-medium text-slate-950">
                          {DAY_NAMES[day.dayOfWeek]}
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={!day.isClosed}
                            label={day.isClosed ? "Cerrado" : "Abierto"}
                            onChange={(open) =>
                              setDays((current) =>
                                current.map((item) =>
                                  item.dayOfWeek === day.dayOfWeek
                                    ? { ...item, isClosed: !open }
                                    : item,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          {day.isClosed ? null : (
                            <Input
                              type="time"
                              placeholder="09:00"
                              value={day.opensAt}
                              onChange={(opensAt) =>
                                setDays((current) =>
                                  current.map((item) =>
                                    item.dayOfWeek === day.dayOfWeek
                                      ? { ...item, opensAt }
                                      : item,
                                  ),
                                )
                              }
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {day.isClosed ? null : (
                            <Input
                              type="time"
                              placeholder="18:00"
                              value={day.closesAt}
                              onChange={(closesAt) =>
                                setDays((current) =>
                                  current.map((item) =>
                                    item.dayOfWeek === day.dayOfWeek
                                      ? { ...item, closesAt }
                                      : item,
                                  ),
                                )
                              }
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </OwnerShell>
  );
}
