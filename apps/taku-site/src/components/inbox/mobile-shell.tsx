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
