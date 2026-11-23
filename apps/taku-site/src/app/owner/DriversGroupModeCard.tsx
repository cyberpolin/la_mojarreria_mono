"use client";

import { useEffect, useState } from "react";
import {
  addGroupConversation,
  fetchDriversGroupMode,
  fetchDriversGroupTargets,
  fetchWhatsAppAccounts,
  updateContactPhone,
  updateDriversGroupMode,
} from "@/components/inbox/api";
import { cx, isAccountConnected } from "@/components/inbox/helpers";
import type { DriversGroupMode } from "@/components/inbox/helpers";
import type { InboxConversation } from "@/components/inbox/types";
import { Button, Field, Input } from "@/components/inbox/ui";

const OPTIONS: Array<{
  value: DriversGroupMode;
  label: string;
  hint: string;
}> = [
  {
    value: "prod",
    label: "Produccion",
    hint: "Los pedidos avisan al grupo actual.",
  },
  {
    value: "test",
    label: "Pruebas",
    hint: "Los pedidos avisan al grupo de pruebas.",
  },
];

const EMPTY_TARGETS: Record<DriversGroupMode, InboxConversation | null> = {
  prod: null,
  test: null,
};

function phoneOf(conversation: InboxConversation | null) {
  return conversation?.contact?.phoneNumber ?? "";
}

export function DriversGroupModeCard() {
  const [mode, setMode] = useState<DriversGroupMode>("prod");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<DriversGroupMode | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [targets, setTargets] =
    useState<Record<DriversGroupMode, InboxConversation | null>>(EMPTY_TARGETS);
  const [drafts, setDrafts] = useState<Record<DriversGroupMode, string>>({
    prod: "",
    test: "",
  });
  const [savedPhones, setSavedPhones] = useState<
    Record<DriversGroupMode, string>
  >({
    prod: "",
    test: "",
  });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void Promise.all([fetchDriversGroupMode(), fetchDriversGroupTargets()])
      .then(([next, groups]) => {
        if (cancelled) return;
        setMode(next);
        setTargets(groups);
        const phones = {
          prod: phoneOf(groups.prod),
          test: phoneOf(groups.test),
        };
        setDrafts(phones);
        setSavedPhones(phones);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo cargar el grupo activo.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: DriversGroupMode) {
    if (next === mode || saving) return;
    setSaving(next);
    setError(null);
    try {
      await updateDriversGroupMode(next);
      setMode(next);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el grupo activo.",
      );
    } finally {
      setSaving(null);
    }
  }

  async function savePhone() {
    const raw = drafts[mode].trim();
    if (!raw) {
      setPhoneError("Escribe un numero.");
      return;
    }
    if (raw === savedPhones[mode] || savingPhone) return;
    setSavingPhone(true);
    setPhoneError(null);
    try {
      const current = targets[mode];
      const contactId = current?.contact?.id;
      if (contactId) {
        const contact = await updateContactPhone(contactId, raw);
        const nextPhone = contact?.phoneNumber ?? raw;
        setTargets((currentTargets) => ({
          ...currentTargets,
          [mode]: current
            ? {
                ...current,
                contact: current.contact
                  ? { ...current.contact, phoneNumber: nextPhone }
                  : current.contact,
              }
            : current,
        }));
        setDrafts((currentDrafts) => ({ ...currentDrafts, [mode]: nextPhone }));
        setSavedPhones((currentSaved) => ({
          ...currentSaved,
          [mode]: nextPhone,
        }));
        return;
      }
      const accounts = await fetchWhatsAppAccounts();
      const account = accounts.find((item) => isAccountConnected(item.status));
      if (!account) {
        throw new Error(
          "Conecta un numero de WhatsApp para guardar el destino.",
        );
      }
      const conversation = await addGroupConversation({
        whatsappAccountId: account.id,
        ...(raw.toLowerCase().endsWith("@g.us")
          ? { groupJid: raw }
          : { phoneNumber: raw }),
        name: mode === "test" ? "Repartidores (prueba)" : "Repartidores",
        role: mode,
      });
      const nextPhone = conversation.contact?.phoneNumber ?? raw;
      setTargets((currentTargets) => ({
        ...currentTargets,
        [mode]: conversation,
      }));
      setDrafts((currentDrafts) => ({ ...currentDrafts, [mode]: nextPhone }));
      setSavedPhones((currentSaved) => ({
        ...currentSaved,
        [mode]: nextPhone,
      }));
    } catch (caught) {
      setPhoneError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el numero.",
      );
    } finally {
      setSavingPhone(false);
    }
  }

  const selectedName = targets[mode]?.contact?.name?.trim() || "";
  const phoneLabel =
    mode === "test" ? "Numero de pruebas" : "Numero de produccion";
  const phoneUnchanged = drafts[mode].trim() === savedPhones[mode];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Grupo de repartidores
      </p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">
        Destino de pedidos
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Cambia esto en produccion para mandar pedidos al grupo de pruebas sin
        tocar el de ahora.
      </p>
      {isLoading ? (
        <p className="mt-5 text-sm font-semibold text-slate-700">Cargando...</p>
      ) : (
        <div className="mt-5 grid gap-2">
          {OPTIONS.map((option) => {
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={Boolean(saving)}
                onClick={() => void save(option.value)}
                className={cx(
                  "min-h-11 rounded-lg border px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:opacity-50",
                  active
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-950",
                )}
              >
                <span className="block text-sm font-semibold">
                  {saving === option.value ? "Guardando..." : option.label}
                </span>
                <span
                  className={cx(
                    "mt-1 block text-xs",
                    active ? "text-slate-300" : "text-slate-500",
                  )}
                >
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error ? <p className="mt-3 text-sm text-slate-700">{error}</p> : null}
      {!isLoading ? (
        <form
          className="mt-6 grid gap-3 border-t border-slate-200 pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void savePhone();
          }}
        >
          <Field
            label={phoneLabel}
            hint={
              selectedName
                ? `Destino actual: ${selectedName}`
                : "Sin destino. Este numero recibira los pedidos."
            }
          >
            <Input
              placeholder="5219931234567"
              inputMode="tel"
              autoComplete="tel"
              value={drafts[mode]}
              onChange={(value) => {
                setPhoneError(null);
                setDrafts((currentDrafts) => ({
                  ...currentDrafts,
                  [mode]: value,
                }));
              }}
            />
          </Field>
          {phoneError ? (
            <p className="text-sm text-slate-700">{phoneError}</p>
          ) : null}
          <Button
            type="submit"
            disabled={savingPhone || phoneUnchanged || !drafts[mode].trim()}
          >
            <span className="inline-flex items-center gap-2">
              {savingPhone ? (
                <span
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-slate-400 border-t-white motion-reduce:animate-none"
                  role="status"
                  aria-label="Guardando"
                />
              ) : null}
              Guardar numero
            </span>
          </Button>
        </form>
      ) : null}
    </article>
  );
}
