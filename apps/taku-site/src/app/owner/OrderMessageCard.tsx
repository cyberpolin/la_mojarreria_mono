"use client";

import { useEffect, useState } from "react";
import {
  fetchDriversPreferences,
  updateDriversOrderMessage,
} from "@/components/inbox/api";
import { Button, Field, TextArea } from "@/components/inbox/ui";

export function OrderMessageCard() {
  const [value, setValue] = useState("Pedido por favor");
  const [saved, setSaved] = useState("Pedido por favor");
  const [isLoading, setIsLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setValue(preferences.orderMessage);
        setSaved(preferences.orderMessage);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo cargar el mensaje.",
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

  async function save() {
    const next = value.trim();
    if (!next) {
      setError("Escribe el mensaje.");
      return;
    }
    if (next === saved || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateDriversOrderMessage(next);
      const stored = result.preferences.driversOrderMessage?.trim();
      if (!stored) {
        throw new Error(
          "El servidor no guardo el mensaje. Actualiza el backend y vuelve a intentar.",
        );
      }
      setValue(stored);
      setSaved(stored);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el mensaje.",
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
        Mensaje de pedido
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Este texto se envia al destino cuando se levanta un pedido.
      </p>
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
          <Field label="Mensaje">
            <TextArea
              rows={3}
              placeholder="Pedido por favor"
              value={value}
              onChange={setValue}
              disabled={saving}
            />
          </Field>
          {error ? <p className="text-sm text-slate-700">{error}</p> : null}
          <Button
            type="submit"
            disabled={saving || value.trim() === saved || !value.trim()}
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
    </article>
  );
}
