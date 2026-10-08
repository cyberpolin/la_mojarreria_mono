"use client";

import { useEffect, useState } from "react";
import {
  fetchDriversGroupMode,
  updateDriversGroupMode,
} from "@/components/inbox/api";
import { cx } from "@/components/inbox/helpers";
import type { DriversGroupMode } from "@/components/inbox/helpers";

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

export function DriversGroupModeCard() {
  const [mode, setMode] = useState<DriversGroupMode>("prod");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<DriversGroupMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void fetchDriversGroupMode()
      .then((next) => {
        if (!cancelled) setMode(next);
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
    </article>
  );
}
