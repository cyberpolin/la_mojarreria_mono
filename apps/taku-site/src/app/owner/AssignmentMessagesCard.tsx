"use client";

import { useEffect, useState } from "react";
import {
  fetchDriversPreferences,
  updateAssignmentMessages,
} from "@/components/inbox/api";
import {
  DEFAULT_CUSTOMER_ASSIGNMENT_MESSAGE,
  DEFAULT_DRIVER_ASSIGNMENT_MESSAGE,
} from "@/components/inbox/orderMessages";
import { Button, Field, TextArea } from "@/components/inbox/ui";

export function AssignmentMessagesCard() {
  const [customerMessage, setCustomerMessage] = useState(
    DEFAULT_CUSTOMER_ASSIGNMENT_MESSAGE,
  );
  const [driverMessage, setDriverMessage] = useState(
    DEFAULT_DRIVER_ASSIGNMENT_MESSAGE,
  );
  const [savedCustomer, setSavedCustomer] = useState(
    DEFAULT_CUSTOMER_ASSIGNMENT_MESSAGE,
  );
  const [savedDriver, setSavedDriver] = useState(
    DEFAULT_DRIVER_ASSIGNMENT_MESSAGE,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLoading(true), 200);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void fetchDriversPreferences()
      .then((preferences) => {
        if (cancelled) return;
        setCustomerMessage(preferences.customerMessage);
        setDriverMessage(preferences.driverMessage);
        setSavedCustomer(preferences.customerMessage);
        setSavedDriver(preferences.driverMessage);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudieron cargar los mensajes.",
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

  useEffect(() => {
    if (!helpOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setHelpOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [helpOpen]);

  const unchanged =
    customerMessage === savedCustomer && driverMessage === savedDriver;

  async function save() {
    const customer = customerMessage.trim();
    const driver = driverMessage.trim();
    if (!customer || !driver) {
      setError("Escribe los dos mensajes.");
      return;
    }
    if (unchanged || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateAssignmentMessages({
        customerMessage: customer,
        driverMessage: driver,
      });
      const storedCustomer = result.preferences.driversCustomerMessage?.trim();
      const storedDriver = result.preferences.driversDriverMessage?.trim();
      if (!storedCustomer || !storedDriver) {
        throw new Error(
          "El servidor no guardo los mensajes. Actualiza el backend y vuelve a intentar.",
        );
      }
      setCustomerMessage(storedCustomer);
      setDriverMessage(storedDriver);
      setSavedCustomer(storedCustomer);
      setSavedDriver(storedDriver);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron guardar los mensajes.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Repartidores
      </p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">
        Mensajes al asignar
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Estos textos se envian al cliente y al repartidor.
      </p>
      <div className="mt-4">
        <Button variant="secondary" onClick={() => setHelpOpen(true)}>
          Ayuda
        </Button>
      </div>
      {isLoading ? (
        <div
          className="mt-5 flex min-h-24 items-center justify-center"
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
      ) : (
        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Field
            label="Mensaje al cliente"
            hint="{repartidor} {total} {tiempo} {cliente}"
          >
            <TextArea
              rows={4}
              placeholder={DEFAULT_CUSTOMER_ASSIGNMENT_MESSAGE}
              value={customerMessage}
              onChange={setCustomerMessage}
              disabled={saving}
            />
          </Field>
          <Field
            label="Mensaje al repartidor"
            hint="{cliente} {a_pagar} {a_cobrar} {envio} {total} {pago} {mojarras} {empanadas}"
          >
            <TextArea
              rows={4}
              placeholder={DEFAULT_DRIVER_ASSIGNMENT_MESSAGE}
              value={driverMessage}
              onChange={setDriverMessage}
              disabled={saving}
            />
          </Field>
          {error ? <p className="text-sm text-slate-700">{error}</p> : null}
          <Button
            type="submit"
            disabled={
              saving ||
              unchanged ||
              !customerMessage.trim() ||
              !driverMessage.trim()
            }
          >
            <span className="inline-flex items-center gap-2">
              {saving ? (
                <span
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-slate-400 border-t-white motion-reduce:animate-none"
                  role="status"
                  aria-label="Cargando"
                />
              ) : null}
              Guardar
            </span>
          </Button>
        </form>
      )}
      {helpOpen ? (
        <AssignmentMessageHelp onClose={() => setHelpOpen(false)} />
      ) : null}
    </article>
  );
}

const CUSTOMER_TOKENS = [
  ["{repartidor}", "Telefono del repartidor."],
  ["{total}", "Total del pedido."],
  ["{tiempo}", "Minutos estimados de entrega."],
  ["{cliente}", "Telefono del cliente."],
] as const;

const DRIVER_TOKENS = [
  ["{cliente}", "Telefono del cliente."],
  ["{a_pagar}", "En efectivo, la comida. En transferencia, $0."],
  ["{a_cobrar}", "En efectivo, el total. En transferencia, solo el envio."],
  ["{envio}", "Costo del envio."],
  ["{total}", "Total del pedido."],
  ["{pago}", "Efectivo o Transferencia."],
  ["{mojarras}", "Cantidad de mojarras."],
  ["{empanadas}", "Cantidad de empanadas."],
  ["{nombre}", "Nombre del repartidor."],
] as const;

function AssignmentMessageHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-message-help-title"
        className="flex max-h-[min(40rem,calc(100dvh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overflow-y-auto p-5 md:p-6">
          <h2
            id="assignment-message-help-title"
            className="text-lg font-semibold text-slate-950"
          >
            Datos del mensaje
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Escribe el dato entre llaves o angulos. {"{cliente}"} y{" "}
            {"<cliente>"} valen lo mismo, en cualquiera de los dos mensajes.
          </p>
          <TokenList title="Para el cliente" tokens={CUSTOMER_TOKENS} />
          <TokenList title="Para el repartidor" tokens={DRIVER_TOKENS} />
        </div>
        <div className="border-t border-slate-200 p-4">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}

function TokenList({
  title,
  tokens,
}: {
  title: string;
  tokens: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <ul className="mt-3 grid gap-3">
        {tokens.map(([token, meaning]) => (
          <li key={token} className="grid gap-1">
            <span className="w-fit rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-950">
              {token}
            </span>
            <span className="text-sm leading-6 text-slate-600">{meaning}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
