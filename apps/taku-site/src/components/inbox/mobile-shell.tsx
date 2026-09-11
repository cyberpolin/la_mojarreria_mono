"use client";

import type { ReactNode } from "react";

export function MobileAuthGate({ next }: { next: string }) {
  return (
    <main className="flex min-h-dvh items-stretch justify-center bg-slate-950">
      <div className="grid h-dvh w-full max-w-[390px] place-items-center bg-slate-100 px-4">
        <a
          href={`/login?next=${encodeURIComponent(next)}`}
          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
        >
          Inicia sesion para ver WhatsApp
        </a>
      </div>
    </main>
  );
}

export function MobilePhoneFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-stretch justify-center bg-slate-950">
      <div className="relative flex h-dvh w-full max-w-[390px] flex-col overflow-hidden bg-slate-100 text-slate-950 shadow-2xl">
        {children}
      </div>
    </main>
  );
}

export function MobileContextMenu({
  title,
  items,
  onClose,
}: {
  title?: string;
  items: Array<{
    label: string;
    danger?: boolean;
    onSelect: () => void;
  }>;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-end bg-slate-950/40 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Cerrar menu"
        onClick={onClose}
      />
      <div className="relative z-10 w-full overflow-hidden rounded-2xl bg-white shadow-xl">
        {title ? (
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            {title}
          </p>
        ) : null}
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className={`flex min-h-12 w-full items-center px-4 text-left text-sm font-medium ${
              item.danger ? "text-slate-950" : "text-slate-800"
            } hover:bg-slate-50`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-12 w-full items-center border-t border-slate-100 px-4 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
