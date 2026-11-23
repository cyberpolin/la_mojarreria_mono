"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchDriversGroupMode,
  fetchPinnedGroupConversation,
  fetchWhatsAppAccounts,
  sendConversationMessage,
} from "./api";
import { AddGroupModal } from "./AddGroupModal";
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
  const [step, setStep] = useState<
    "form" | "summary" | "missing-group" | "done"
  >("form");
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
    void fetchWhatsAppAccounts()
      .then((rows) => {
        setAccounts(rows);
      })
      .catch(() => undefined);
    void fetchDriversGroupMode()
      .then(setGroupMode)
      .catch(() => undefined);
  }, []);

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
    await sendConversationMessage(conversationId, DRIVERS_ORDER_MESSAGE);
    setError(null);
    setStep("done");
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
      latitude: message?.latitude,
      longitude: message?.longitude,
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
        {step === "summary" || step === "missing-group" ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep(step === "missing-group" ? "summary" : "form");
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

      {step === "form" ? (
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

      {step === "summary" ? (
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

      {step === "missing-group" ? (
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

      {step === "done" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-base font-semibold">Pedido listo</p>
          <p className="text-sm text-slate-500">
            {payment === "transferencia"
              ? "Pago transferencia"
              : "Pago efectivo"}
            .{" "}
            {`Se envio "${DRIVERS_ORDER_MESSAGE}" al grupo de ${
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
