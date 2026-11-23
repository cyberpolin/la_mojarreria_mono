"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchCustomerLocations,
  fetchDriversPreferences,
  fetchPinnedGroupConversation,
  fetchWhatsAppAccounts,
  saveCustomerLocation,
  sendConversationMessage,
  type CustomerLocation,
} from "./api";
import { AddGroupModal } from "./AddGroupModal";
import { locationsMatch, mockFoundLocation } from "./customerLocations";
import { Field, Input } from "./ui";
import {
  DELIVERY_BASE,
  DELIVERY_INCLUDED_KM,
  DELIVERY_PER_KM,
  DRIVERS_ORDER_MESSAGE,
  EMPANADA_PRICE,
  MOJARRA_PRICE,
  formatMxn,
  parseNonNegativeNumber,
  parseQuantity,
  raiseOrderTotals,
} from "./raiseOrder";
import { savePendingOrder } from "./pendingOrders";
import type { DriversGroupMode } from "./helpers";
import type { InboxMessage, InboxWhatsAppAccount } from "./types";

type OrderStep =
  | "location-choice"
  | "location-search"
  | "save-name"
  | "form"
  | "summary"
  | "missing-group"
  | "done";

type ChosenLocation = {
  latitude: number;
  longitude: number;
  name: string | null;
};

function modalHost() {
  return document.getElementById("taku-mobile-window") ?? document.body;
}

export function RaiseOrderModal({
  onClose,
  account = null,
  message = null,
  customerPhone = null,
  customerConversationId = null,
}: {
  onClose: () => void;
  account?: InboxWhatsAppAccount | null;
  message?: InboxMessage | null;
  customerPhone?: string | null;
  customerConversationId?: string | null;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [step, setStep] = useState<OrderStep>("form");
  const [entryStep, setEntryStep] = useState<OrderStep>("form");
  const [savedLocations, setSavedLocations] = useState<CustomerLocation[]>([]);
  const [chosen, setChosen] = useState<ChosenLocation | null>(null);
  const [locationName, setLocationName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHit, setSearchHit] = useState<ReturnType<
    typeof mockFoundLocation
  > | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [driversMessage, setDriversMessage] = useState(DRIVERS_ORDER_MESSAGE);
  const [kilometers, setKilometers] = useState("");
  const [mojarras, setMojarras] = useState("0");
  const [empanadas, setEmpanadas] = useState("0");
  const [payment, setPayment] = useState<"efectivo" | "transferencia" | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<InboxWhatsAppAccount[]>(
    account ? [account] : [],
  );
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupMode, setGroupMode] = useState<DriversGroupMode>("prod");

  useEffect(() => {
    setHost(modalHost());
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (ready) {
      setShowLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLoading(true), 200);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    void fetchWhatsAppAccounts()
      .then((rows) => {
        setAccounts(rows);
      })
      .catch(() => undefined);
  }, []);

  const pinLatitude =
    message && typeof message.latitude === "number" ? message.latitude : null;
  const pinLongitude =
    message && typeof message.longitude === "number" ? message.longitude : null;
  const hasPin =
    message?.type === "location" ||
    (pinLatitude != null && pinLongitude != null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const pin =
      hasPin && pinLatitude != null && pinLongitude != null
        ? { latitude: pinLatitude, longitude: pinLongitude }
        : null;
    void Promise.all([
      fetchDriversPreferences().catch(() => null),
      customerPhone
        ? fetchCustomerLocations(customerPhone).catch(() => [])
        : Promise.resolve([] as CustomerLocation[]),
    ]).then(([preferences, locations]) => {
      if (cancelled) return;
      if (preferences) {
        setGroupMode(preferences.mode);
        setDriversMessage(preferences.orderMessage);
      }
      setSavedLocations(locations);
      if (pin) {
        const existing = locations.find((item) => locationsMatch(item, pin));
        setChosen(
          existing ?? {
            latitude: pin.latitude,
            longitude: pin.longitude,
            name: null,
          },
        );
        const next = existing ? "form" : "save-name";
        setLocationName("");
        setEntryStep(next);
        setStep(next);
      } else {
        setChosen(null);
        setEntryStep("location-choice");
        setStep("location-choice");
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [customerPhone, hasPin, pinLatitude, pinLongitude]);

  const totals = raiseOrderTotals({
    kilometers: parseNonNegativeNumber(kilometers),
    mojarras: parseQuantity(mojarras),
    empanadas: parseQuantity(empanadas),
  });
  const canContinue = kilometers.trim() !== "";
  const overlayClass =
    host?.id === "taku-mobile-window"
      ? "absolute inset-0 z-[80]"
      : "fixed inset-0 z-[80]";

  async function sendToDriversGroup(conversationId: string) {
    await sendConversationMessage(conversationId, driversMessage);
    setError(null);
    setStep("done");
  }

  async function saveNamedLocation() {
    const name = locationName.trim();
    if (!name || !chosen || savingLocation) return;
    if (!customerPhone?.trim()) {
      setError(
        "Este pedido no tiene el telefono del cliente. Abrelo desde el chat del cliente.",
      );
      return;
    }
    setSavingLocation(true);
    setError(null);
    try {
      const saved = await saveCustomerLocation({
        customerPhone,
        name,
        latitude: chosen.latitude,
        longitude: chosen.longitude,
      });
      setSavedLocations((current) =>
        current.some((item) => item.id === saved.id)
          ? current
          : [saved, ...current],
      );
      setChosen(saved);
      setStep("form");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar la ubicacion.",
      );
    } finally {
      setSavingLocation(false);
    }
  }

  async function handlePayment(nextPayment: "efectivo" | "transferencia") {
    if (submitting) return;
    setPayment(nextPayment);
    setSubmitting(true);
    setError(null);
    if (!customerPhone?.trim()) {
      setSubmitting(false);
      setError(
        "Este pedido no tiene el telefono del cliente. Abrelo desde el chat del cliente.",
      );
      return;
    }
    savePendingOrder({
      totals,
      payment: nextPayment,
      latitude: chosen?.latitude ?? message?.latitude,
      longitude: chosen?.longitude ?? message?.longitude,
      customerPhone,
      customerConversationId,
      whatsappAccountId: account?.id,
    });
    try {
      const group = await fetchPinnedGroupConversation(account?.id);
      if (!group) {
        setStep("missing-group");
        setGroupPickerOpen(true);
        return;
      }
      await sendToDriversGroup(group.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo avisar a los repartidores.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!host) return null;

  return createPortal(
    <div className={`${overlayClass} flex flex-col bg-white text-slate-950`}>
      <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        {step === "summary" ||
        step === "missing-group" ||
        step === "location-search" ||
        (step === "form" && entryStep !== "form") ||
        (step === "save-name" && entryStep !== "save-name") ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (step === "missing-group") setStep("summary");
              else if (step === "summary") setStep("form");
              else if (step === "form") setStep(entryStep);
              else if (step === "save-name") setStep("location-search");
              else setStep("location-choice");
            }}
            className="grid h-11 w-11 place-items-center text-lg"
            aria-label="Regresar"
          >
            ←
          </button>
        ) : (
          <span className="w-11" />
        )}
        <h2 className="flex-1 text-center text-base font-semibold">
          {step === "done"
            ? "Pedido"
            : step === "missing-group"
              ? "Grupo de repartidores"
              : step === "location-search"
                ? "Buscar ubicacion"
                : step === "save-name" || step === "location-choice"
                  ? "Ubicacion"
                  : "Levantar pedido"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="grid h-11 w-11 place-items-center text-xl text-slate-500"
          aria-label="Cerrar"
        >
          ×
        </button>
      </header>

      {!ready ? (
        <div
          className="flex min-h-24 flex-1 items-center justify-center"
          aria-busy="true"
        >
          {showLoading ? (
            <span
              className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950 motion-reduce:animate-none"
              role="status"
              aria-label="Cargando"
            />
          ) : null}
        </div>
      ) : null}

      {ready && step === "location-choice" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {savedLocations.length > 0 ? (
              <>
                <p className="text-sm font-semibold text-slate-950">
                  Ubicaciones guardadas
                </p>
                <div className="grid gap-2">
                  {savedLocations.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setError(null);
                        setChosen(item);
                        setStep("form");
                      }}
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-950 hover:border-slate-950"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Este pedido no trae ubicacion.
              </p>
            )}
            {error ? <p className="text-sm text-slate-700">{error}</p> : null}
          </div>
          <div className="border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSearchQuery("");
                setSearchHit(null);
                setStep("location-search");
              }}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Buscar ubicacion
            </button>
          </div>
        </div>
      ) : null}

      {ready && step === "location-search" ? (
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            const query = searchQuery.trim();
            if (!query) return;
            setSearchHit(mockFoundLocation(query));
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <Field
              label="Buscar"
              hint="Busqueda de ejemplo. Elige el resultado para guardarlo."
            >
              <Input
                placeholder="Calle, colonia o referencia"
                value={searchQuery}
                onChange={(value) => {
                  setSearchQuery(value);
                  setSearchHit(null);
                }}
              />
            </Field>
            {searchHit ? (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-950">
                  {searchHit.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Ubicacion de ejemplo
                </p>
              </div>
            ) : null}
          </div>
          <div className="grid gap-2 border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {searchHit ? (
              <button
                type="button"
                onClick={() => {
                  setChosen({
                    latitude: searchHit.latitude,
                    longitude: searchHit.longitude,
                    name: null,
                  });
                  setLocationName(searchHit.name);
                  setError(null);
                  setStep("save-name");
                }}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Usar esta ubicacion
              </button>
            ) : (
              <button
                type="submit"
                disabled={!searchQuery.trim()}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Buscar
              </button>
            )}
          </div>
        </form>
      ) : null}

      {ready && step === "save-name" ? (
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void saveNamedLocation();
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <p className="text-sm text-slate-600">
              Esta ubicacion aun no esta guardada. Ponle un nombre para usarla
              en el siguiente pedido.
            </p>
            <Field label="Nombre">
              <Input
                placeholder="Casa, trabajo, local"
                value={locationName}
                onChange={setLocationName}
              />
            </Field>
            {error ? <p className="text-sm text-slate-700">{error}</p> : null}
          </div>
          <div className="border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={!locationName.trim() || savingLocation}
              aria-busy={savingLocation}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingLocation ? (
                <span
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-slate-400 border-t-white motion-reduce:animate-none"
                  role="status"
                  aria-label="Cargando"
                />
              ) : null}
              Guardar y continuar
            </button>
          </div>
        </form>
      ) : null}

      {ready && step === "form" ? (
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canContinue) return;
            setStep("summary");
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <Field
              label="Kilometros"
              hint={`Minimo ${formatMxn(DELIVERY_BASE)} e incluye los primeros ${DELIVERY_INCLUDED_KM} km. Cada km extra cuesta ${formatMxn(DELIVERY_PER_KM)}.`}
            >
              <Input
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                placeholder="0"
                value={kilometers}
                onChange={setKilometers}
              />
            </Field>
            <Field
              label="Cantidad de mojarras"
              hint={`Cada mojarra cuesta ${formatMxn(MOJARRA_PRICE)}.`}
            >
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="numeric"
                placeholder="0"
                value={mojarras}
                onChange={setMojarras}
              />
            </Field>
            <Field
              label="Cantidad de empanadas"
              hint={`Cada empanada cuesta ${formatMxn(EMPANADA_PRICE)}.`}
            >
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="numeric"
                placeholder="0"
                value={empanadas}
                onChange={setEmpanadas}
              />
            </Field>
          </div>
          <div className="border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="submit"
              disabled={!canContinue}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ver resumen
            </button>
          </div>
        </form>
      ) : null}

      {ready && step === "summary" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <p className="text-sm font-semibold text-slate-950">
              Resumen del pedido
            </p>
            <dl className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
              <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-slate-600">
                  Envio · {totals.kilometers} km
                  <span className="mt-1 block text-xs text-slate-500">
                    {totals.extraKilometers > 0
                      ? `${formatMxn(DELIVERY_BASE)} + ${totals.extraKilometers} km extra × ${formatMxn(DELIVERY_PER_KM)}`
                      : `${formatMxn(DELIVERY_BASE)} (incluye ${DELIVERY_INCLUDED_KM} km)`}
                  </span>
                </dt>
                <dd className="font-semibold">{formatMxn(totals.delivery)}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-slate-600">
                  Mojarras · {totals.mojarras}
                  <span className="mt-1 block text-xs text-slate-500">
                    {totals.mojarras} × {formatMxn(MOJARRA_PRICE)}
                  </span>
                </dt>
                <dd className="font-semibold">
                  {formatMxn(totals.mojarraTotal)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-slate-600">
                  Empanadas · {totals.empanadas}
                  <span className="mt-1 block text-xs text-slate-500">
                    {totals.empanadas} × {formatMxn(EMPANADA_PRICE)}
                  </span>
                </dt>
                <dd className="font-semibold">
                  {formatMxn(totals.empanadaTotal)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3 text-sm">
                <dt className="font-semibold text-slate-950">Total</dt>
                <dd className="font-semibold text-slate-950">
                  {formatMxn(totals.total)}
                </dd>
              </div>
            </dl>
            {error ? (
              <p className="mt-4 text-sm text-slate-700">{error}</p>
            ) : null}
          </div>
          <div className="grid gap-2 border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handlePayment("efectivo")}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && payment === "efectivo"
                ? "Enviando..."
                : "Pago efectivo"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handlePayment("transferencia")}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-950 hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && payment === "transferencia"
                ? "Enviando..."
                : "Pago transferencia"}
            </button>
          </div>
        </div>
      ) : null}

      {ready && step === "missing-group" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-base font-semibold">
            Falta el grupo de repartidores
          </p>
          <p className="text-sm text-slate-500">
            {groupMode === "prod"
              ? "Agrega el grupo de produccion para avisar el pedido."
              : "Agrega un grupo de pruebas. El de produccion no se reemplaza."}
          </p>
          {error ? <p className="text-sm text-slate-700">{error}</p> : null}
          <button
            type="button"
            onClick={() => setGroupPickerOpen(true)}
            className="inline-flex min-h-11 w-full max-w-xs items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Agregar grupo
          </button>
        </div>
      ) : null}

      {ready && step === "done" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-base font-semibold">Pedido listo</p>
          <p className="text-sm text-slate-500">
            {payment === "transferencia"
              ? "Pago transferencia"
              : "Pago efectivo"}
            .{" "}
            {`Se envio "${driversMessage}" al grupo de ${
              groupMode === "prod" ? "produccion" : "pruebas"
            }.`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 w-full max-w-xs items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>
      ) : null}
      {groupPickerOpen ? (
        <AddGroupModal
          accounts={accounts.length > 0 ? accounts : account ? [account] : []}
          onClose={() => setGroupPickerOpen(false)}
          onAdded={(conversation) => {
            setGroupPickerOpen(false);
            void sendToDriversGroup(conversation.id).catch(
              (caught: unknown) => {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "No se pudo avisar a los repartidores.",
                );
              },
            );
          }}
        />
      ) : null}
    </div>,
    host,
  );
}
