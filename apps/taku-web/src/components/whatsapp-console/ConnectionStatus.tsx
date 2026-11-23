"use client";

import type { SyncState } from "./types";

const labels: Record<SyncState, string> = {
  connected: "Conectado",
  syncing: "Sincronizando",
  reconnecting: "Reconectando",
  offline: "Desconectado",
};

export function ConnectionStatus({ state }: { state: SyncState }) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs text-slate-300">
      <span
        className={
          state === "connected"
            ? "h-2 w-2 rounded-full bg-slate-100"
            : state === "syncing" || state === "reconnecting"
              ? "h-2 w-2 rounded-full bg-slate-500"
              : "h-2 w-2 rounded-full bg-slate-700"
        }
      />
      {labels[state]}
    </div>
  );
}
