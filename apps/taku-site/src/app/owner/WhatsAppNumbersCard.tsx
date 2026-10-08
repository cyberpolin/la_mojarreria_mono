"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/inbox/ui";
import { cx } from "@/components/inbox/helpers";

export type OwnerWhatsAppNumber = {
  id: string;
  displayName: string;
  phoneNumber: string | null;
  status: string;
  lastConnectedAt?: string | null;
  lastDisconnectedAt?: string | null;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function formatPhone(phone: string | null | undefined) {
  const value = phone?.trim() ?? "";
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return value;
  return digits.slice(-10);
}

function formatDateTime(value: string | null | undefined) {
  if (!hasText(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
      date,
    ),
    time: new Intl.DateTimeFormat("es-MX", { timeStyle: "short" }).format(date),
  };
}

function StatusIcon({ status }: { status: string }) {
  const connected = status === "connected";
  const label =
    status === "connected"
      ? "Conectado"
      : status === "disconnected"
        ? "Desconectado"
        : status === "qr_required"
          ? "QR requerido"
          : status === "connecting"
            ? "Conectando"
            : status === "failed"
              ? "Fallido"
              : status;

  return (
    <span
      title={label}
      aria-label={label}
      className={cx(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
        connected ? "bg-slate-950 text-white" : "bg-slate-200 text-slate-600",
      )}
    >
      {connected ? (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            fill="currentColor"
            d="M7.7 13.3 4.9 10.5l-1.2 1.2 4 4 8-8-1.2-1.2z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            fill="currentColor"
            d="M5.3 4.2 4.2 5.3 8.9 10l-4.7 4.7 1.1 1.1L10 11.1l4.7 4.7 1.1-1.1L11.1 10l4.7-4.7-1.1-1.1L10 8.9z"
          />
        </svg>
      )}
    </span>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="4" r="1.6" fill="currentColor" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" />
      <circle cx="10" cy="16" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function WhatsAppNumbersCard({
  numbers,
  onEditNumber,
  onDeleteNumber,
  onOpenInbox,
  onAddNumber,
}: {
  numbers: OwnerWhatsAppNumber[];
  onEditNumber: (numberId: string) => void;
  onDeleteNumber: (number: OwnerWhatsAppNumber) => void;
  onOpenInbox: (number: OwnerWhatsAppNumber) => void;
  onAddNumber: () => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Numeros conectados
        </p>
        <button
          type="button"
          onClick={onAddNumber}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          <span aria-hidden="true">+</span>
          Agregar numero
        </button>
      </div>

      {numbers.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          Este tenant no tiene numeros de WhatsApp.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {numbers.map((number) => {
            const phone = formatPhone(number.phoneNumber);
            const lastConnected = formatDateTime(number.lastConnectedAt);
            const lastDisconnected = formatDateTime(number.lastDisconnectedAt);
            const name = number.displayName.trim();
            return (
              <div
                key={number.id}
                role="button"
                tabIndex={0}
                onClick={() => onEditNumber(number.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onEditNumber(number.id);
                  }
                }}
                className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                <div className="flex items-start gap-3">
                  <StatusIcon status={number.status} />
                  <div className="min-w-0 flex-1">
                    {name ? (
                      <p className="text-base font-semibold text-slate-950">
                        {name}
                      </p>
                    ) : null}
                    {phone ? (
                      <p
                        className={
                          name
                            ? "mt-1 text-sm text-slate-700"
                            : "text-sm text-slate-700"
                        }
                      >
                        {phone}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className="relative"
                    ref={openMenuId === number.id ? menuRef : undefined}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label={`Opciones de ${number.displayName}`}
                      aria-expanded={openMenuId === number.id}
                      aria-haspopup="menu"
                      onClick={() =>
                        setOpenMenuId((current) =>
                          current === number.id ? null : number.id,
                        )
                      }
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-white hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                    >
                      <DotsIcon />
                    </button>
                    {openMenuId === number.id ? (
                      <div
                        role="menu"
                        className="absolute right-0 z-20 mt-1 min-w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-xl shadow-slate-950/10"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuId(null);
                            onEditNumber(number.id);
                          }}
                          className="flex min-h-11 w-full items-center px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuId(null);
                            onDeleteNumber(number);
                          }}
                          className="flex min-h-11 w-full items-center px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                {lastConnected || lastDisconnected ? (
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {lastConnected ? (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Ultima conexion
                        </dt>
                        <dd className="mt-1 grid text-sm font-medium text-slate-950">
                          <span>{lastConnected.date}</span>
                          <span>{lastConnected.time}</span>
                        </dd>
                      </div>
                    ) : null}
                    {lastDisconnected ? (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Ultima desconexion
                        </dt>
                        <dd className="mt-1 grid text-sm font-medium text-slate-950">
                          <span>{lastDisconnected.date}</span>
                          <span>{lastDisconnected.time}</span>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
                {phone ? (
                  <div
                    className="mt-4"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Button onClick={() => onOpenInbox(number)}>
                      Abrir chat
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
