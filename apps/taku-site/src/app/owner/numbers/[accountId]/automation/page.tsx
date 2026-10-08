"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { takuApi } from "@/lib/taku-api";
import { Button, Field, Select, TextArea } from "@/components/inbox/ui";
import { CheckOption } from "../../../CheckOption";
import { NumberBreadcrumb } from "../../../NumberBreadcrumb";
import { OwnerShell } from "../../../OwnerShell";
import type { OwnerWhatsAppAccount } from "../../../NumberForms";
import type { OwnerBotSettings } from "../../../numberTypes";

type AutomationForm = {
  enabled: boolean;
  afterHoursEnabled: boolean;
  afterHoursResponder: "static_message" | "assigned_bot" | "none";
  afterHoursMessage: string;
  rulesEnabled: boolean;
  aiEnabled: boolean;
};

function formFromSettings(settings: OwnerBotSettings | null): AutomationForm {
  return {
    enabled: settings?.enabled ?? false,
    afterHoursEnabled: settings?.afterHoursEnabled ?? false,
    afterHoursResponder: settings?.afterHoursResponder ?? "static_message",
    afterHoursMessage: settings?.afterHoursMessage ?? "",
    rulesEnabled: settings?.rulesEnabled ?? false,
    aiEnabled: settings?.aiEnabled ?? false,
  };
}

export default function OwnerNumberAutomationPage() {
  const params = useParams();
  const accountId = String(params.accountId ?? "");
  const [account, setAccount] = useState<OwnerWhatsAppAccount | null>(null);
  const [form, setForm] = useState<AutomationForm>(formFromSettings(null));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      const [loadedAccount, settings] = await Promise.all([
        takuApi<OwnerWhatsAppAccount>(`/whatsapp-accounts/${accountId}`),
        takuApi<OwnerBotSettings>(
          `/bot-settings?whatsappAccountId=${encodeURIComponent(accountId)}`,
        ),
      ]);
      setAccount(loadedAccount);
      setForm(formFromSettings(settings));
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cargar la automatizacion.",
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
    setMessage(null);
    if (
      form.afterHoursEnabled &&
      form.afterHoursResponder === "static_message" &&
      !form.afterHoursMessage.trim()
    ) {
      setMessage("Escribe el mensaje fijo fuera de horario.");
      return;
    }
    setIsSaving(true);
    try {
      await takuApi("/bot-settings", {
        method: "PATCH",
        body: JSON.stringify({
          whatsappAccountId: accountId,
          ...form,
          afterHoursMessage: form.afterHoursMessage.trim(),
        }),
      });
      setMessage("Automatizacion guardada.");
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar la automatizacion.",
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
            current="Automatizacion"
          />
          {error ? (
            <div className="rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-700">
              {error}
            </div>
          ) : null}
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-700">
              Cargando automatizacion...
            </div>
          ) : (
            <section className="max-w-xl rounded-xl border border-slate-200 bg-white p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Automatizacion
              </p>
              {message ? (
                <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                  {message}
                </div>
              ) : null}
              <div className="mt-5 grid gap-1">
                <CheckOption
                  checked={form.enabled}
                  label="Automatizacion"
                  onChange={(enabled) =>
                    setForm((current) => ({ ...current, enabled }))
                  }
                />
                <CheckOption
                  checked={form.rulesEnabled}
                  label="Reglas"
                  onChange={(rulesEnabled) =>
                    setForm((current) => ({ ...current, rulesEnabled }))
                  }
                />
                <CheckOption
                  checked={form.aiEnabled}
                  label="IA"
                  onChange={(aiEnabled) =>
                    setForm((current) => ({ ...current, aiEnabled }))
                  }
                />
                <CheckOption
                  checked={form.afterHoursEnabled}
                  label="Fuera de horario"
                  onChange={(afterHoursEnabled) =>
                    setForm((current) => ({ ...current, afterHoursEnabled }))
                  }
                />
                {form.afterHoursEnabled ? (
                  <div className="mt-3 grid gap-4">
                    <Field label="Responder">
                      <Select
                        value={form.afterHoursResponder}
                        onChange={(afterHoursResponder) =>
                          setForm((current) => ({
                            ...current,
                            afterHoursResponder:
                              afterHoursResponder as AutomationForm["afterHoursResponder"],
                          }))
                        }
                      >
                        <option value="static_message">Mensaje fijo</option>
                        <option value="assigned_bot">Bot asignado</option>
                        <option value="none">Sin respuesta</option>
                      </Select>
                    </Field>
                    {form.afterHoursResponder === "static_message" ? (
                      <Field label="Mensaje fijo">
                        <TextArea
                          placeholder="Mensaje fuera de horario"
                          value={form.afterHoursMessage}
                          onChange={(afterHoursMessage) =>
                            setForm((current) => ({
                              ...current,
                              afterHoursMessage,
                            }))
                          }
                        />
                      </Field>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-4">
                  <Button disabled={isSaving} onClick={() => void save()}>
                    {isSaving ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </OwnerShell>
  );
}
