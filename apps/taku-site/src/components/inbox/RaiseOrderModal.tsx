"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Field, Input } from "./ui";
import {
  DELIVERY_BASE,
  DELIVERY_PER_KM,
  EMPANADA_PRICE,
  MOJARRA_PRICE,
  formatMxn,
  parseNonNegativeNumber,
  parseQuantity,
  raiseOrderTotals,
} from "./raiseOrder";

function modalHost() {
  return document.getElementById("taku-mobile-window") ?? document.body;
}

export function RaiseOrderModal({ onClose }: { onClose: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [step, setStep] = useState<"form" | "summary" | "done">("form");
  const [kilometers, setKilometers] = useState("");
  const [mojarras, setMojarras] = useState("0");
  const [empanadas, setEmpanadas] = useState("0");

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

  if (!host) return null;

  return createPortal(
    <div className={`${overlayClass} flex flex-col bg-white text-slate-950`}>
      <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        {step === "summary" ? (
          <button
            type="button"
            onClick={() => setStep("form")}
            className="grid h-11 w-11 place-items-center text-lg"
            aria-label="Regresar"
          >
            ←
          </button>
        ) : (
          <span className="w-11" />
        )}
        <h2 className="flex-1 text-center text-base font-semibold">
          {step === "done" ? "Pedido" : "Levantar pedido"}
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
              hint={`Cada kilometro cuesta ${formatMxn(DELIVERY_PER_KM)}. Arrancamos en ${formatMxn(DELIVERY_BASE)}.`}
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
                    {formatMxn(DELIVERY_BASE)} + {totals.kilometers} ×{" "}
                    {formatMxn(DELIVERY_PER_KM)}
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
          </div>
          <div className="border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setStep("done")}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Levantar pedido y pedir repartidor
            </button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-base font-semibold">Pedido listo</p>
          <p className="text-sm text-slate-500">
            El envio al grupo de repartidores se conectara despues.
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
    </div>,
    host,
  );
}
