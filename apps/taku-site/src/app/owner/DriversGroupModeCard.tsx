"use client";

import { useEffect, useState } from "react";
import { AddGroupModal } from "@/components/inbox/AddGroupModal";
import {
  addGroupConversation,
  createConversation,
  fetchConversationByPhone,
  fetchDriversGroupTargets,
  fetchDriversPreferences,
  fetchWhatsAppAccounts,
  updateDriversGroupMode,
  updateDriversPhone,
} from "@/components/inbox/api";
import { cx, isAccountConnected } from "@/components/inbox/helpers";
import type { DriversGroupMode } from "@/components/inbox/helpers";
import type {
  InboxConversation,
  InboxWhatsAppAccount,
} from "@/components/inbox/types";
import { Button, Field, Input } from "@/components/inbox/ui";

const OPTIONS: Array<{
  value: DriversGroupMode;
  label: string;
  hint: string;
}> = [
  {
    value: "prod",
    label: "Produccion",
    hint: "Los pedidos avisan al destino de produccion.",
  },
  {
    value: "test",
    label: "Pruebas",
    hint: "Los pedidos avisan al numero o grupo de pruebas.",
  },
];

const EMPTY_TARGETS: Record<DriversGroupMode, InboxConversation | null> = {
  prod: null,
  test: null,
};

function phoneOf(conversation: InboxConversation | null) {
  return conversation?.contact?.phoneNumber ?? "";
}

function groupTitle(conversation: InboxConversation | null) {
  const name = conversation?.contact?.name?.trim() ?? "";
  if (!name || name.toLowerCase().endsWith("@g.us")) return "";
  return name;
}

export function DriversGroupModeCard() {
  const [mode, setMode] = useState<DriversGroupMode>("prod");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<DriversGroupMode | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openingPicker, setOpeningPicker] = useState(false);
  const [accounts, setAccounts] = useState<InboxWhatsAppAccount[]>([]);
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
    void Promise.all([fetchDriversPreferences(), fetchDriversGroupTargets()])
      .then(async ([preferences, groups]) => {
        if (cancelled) return;
        let prod = groups.prod;
        if (preferences.prodPhone.toLowerCase().endsWith("@g.us")) {
          prod =
            (await fetchConversationByPhone(preferences.prodPhone)) ?? prod;
        }
        if (cancelled) return;
        const nextTargets = {
          prod,
          test: groups.test?.id === prod?.id ? null : groups.test,
        };
        setMode(preferences.mode);
        setTargets(nextTargets);
        const phones = {
          prod: preferences.prodPhone || phoneOf(nextTargets.prod),
          test: preferences.testPhone || phoneOf(nextTargets.test),
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
      const saved = await updateDriversPhone(mode, raw);
      const nextPhone = (
        mode === "test"
          ? saved.preferences.driversTestPhone
          : saved.preferences.driversProdPhone
      )?.trim();
      if (!nextPhone) {
        throw new Error(
          "El servidor no guardo el numero. Actualiza el backend y vuelve a intentar.",
        );
      }
      const isGroup = nextPhone.toLowerCase().endsWith("@g.us");
      if (isGroup) {
        const accounts = await fetchWhatsAppAccounts();
        const account = accounts.find((item) =>
          isAccountConnected(item.status),
        );
        if (!account) {
          throw new Error(
            "Conecta un numero de WhatsApp para guardar el grupo.",
          );
        }
        await addGroupConversation({
          whatsappAccountId: account.id,
          groupJid: nextPhone,
          name: mode === "test" ? "Repartidores (prueba)" : "Repartidores",
          role: mode,
        });
      } else {
        const accounts = await fetchWhatsAppAccounts();
        const account = accounts.find((item) =>
          isAccountConnected(item.status),
        );
        if (account) {
          await createConversation({
            phoneNumber: nextPhone,
            whatsappAccountId: account.id,
            name: mode === "test" ? "Pruebas" : "Produccion",
          });
        }
      }
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

  const prodTitle = groupTitle(targets.prod);
  const phoneLabel = "Numero de pruebas";
  const phoneUnchanged = drafts.test.trim() === savedPhones.test;

  async function openProdPicker() {
    if (openingPicker) return;
    setOpeningPicker(true);
    setPhoneError(null);
    try {
      const rows = accounts.length ? accounts : await fetchWhatsAppAccounts();
      setAccounts(rows);
      setPickerOpen(true);
    } catch (caught) {
      setPhoneError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar los grupos.",
      );
    } finally {
      setOpeningPicker(false);
    }
  }

  async function selectProdGroup(conversation: InboxConversation) {
    const jid = conversation.contact?.phoneNumber?.trim() ?? "";
    if (!jid.toLowerCase().endsWith("@g.us")) {
      throw new Error("Ese destino no es un grupo.");
    }
    setTargets((current) => ({ ...current, prod: conversation }));
    setPickerOpen(false);
    const saved = await updateDriversPhone("prod", jid);
    const stored = saved.preferences.driversProdPhone?.trim();
    if (!stored) {
      throw new Error(
        "El servidor no guardo el grupo. Actualiza el backend y vuelve a intentar.",
      );
    }
    setDrafts((current) => ({ ...current, prod: stored }));
    setSavedPhones((current) => ({ ...current, prod: stored }));
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Grupo de repartidores
      </p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">
        Destino de pedidos
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Cambia esto en produccion para mandar pedidos al destino de pruebas sin
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
                  {option.value === "prod" && prodTitle
                    ? prodTitle
                    : option.hint}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error ? <p className="mt-3 text-sm text-slate-700">{error}</p> : null}
      {!isLoading && mode === "prod" ? (
        <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5">
          <p className="text-sm font-medium text-slate-700">
            Grupo de produccion
          </p>
          <p className="text-base font-semibold text-slate-950">
            {prodTitle || "Sin grupo"}
          </p>
          <p className="text-xs text-slate-500">
            {prodTitle
              ? "Los pedidos de produccion se envian a este grupo."
              : "Elige el grupo que recibira los pedidos."}
          </p>
          {phoneError ? (
            <p className="text-sm text-slate-700">{phoneError}</p>
          ) : null}
          <Button
            disabled={openingPicker}
            onClick={() => void openProdPicker()}
          >
            <span className="inline-flex items-center gap-2">
              {openingPicker ? (
                <span
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-slate-400 border-t-white motion-reduce:animate-none"
                  role="status"
                  aria-label="Cargando"
                />
              ) : null}
              {prodTitle ? "Cambiar grupo" : "Elegir grupo"}
            </span>
          </Button>
        </div>
      ) : null}
      {!isLoading && mode === "test" ? (
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
              savedPhones.test && !savedPhones.test.includes("@g.us")
                ? "Los pedidos de este destino se envian a este numero."
                : "Sin destino. Este numero recibira los pedidos."
            }
          >
            <Input
              placeholder="5219931234567"
              inputMode="tel"
              autoComplete="tel"
              value={drafts.test}
              onChange={(value) => {
                setPhoneError(null);
                setDrafts((currentDrafts) => ({
                  ...currentDrafts,
                  test: value,
                }));
              }}
            />
          </Field>
          {phoneError ? (
            <p className="text-sm text-slate-700">{phoneError}</p>
          ) : null}
          <Button
            type="submit"
            disabled={savingPhone || phoneUnchanged || !drafts.test.trim()}
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
      {pickerOpen ? (
        <AddGroupModal
          accounts={accounts}
          role="prod"
          onClose={() => setPickerOpen(false)}
          onAdded={(conversation) => {
            void selectProdGroup(conversation).catch((caught: unknown) => {
              setPhoneError(
                caught instanceof Error
                  ? caught.message
                  : "No se pudo guardar el grupo.",
              );
            });
          }}
        />
      ) : null}
    </article>
  );
}
