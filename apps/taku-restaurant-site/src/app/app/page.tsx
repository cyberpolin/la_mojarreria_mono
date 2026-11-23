"use client";

import { useEffect, useState } from "react";
import { restaurantApi } from "@/lib/api";
import { Card } from "@/components/ui";

type Me = {
  restaurant: { name: string; plan: string };
};

export default function BackofficeHomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void restaurantApi<Me>("/session/me")
      .then(setMe)
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : "No se pudo cargar.",
        );
      });
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Restaurante
        </p>
        <h2 className="mt-2 text-lg font-semibold">
          {me?.restaurant.name ?? "Cargando..."}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Plan {me?.restaurant.plan ?? "-"}.
        </p>
        {error ? <p className="mt-3 text-sm text-slate-700">{error}</p> : null}
      </Card>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Gastos
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Captura concepto y cantidad. Lo usa tambien la app movil.
        </p>
        <a
          href="/app/gastos"
          className="mt-4 inline-flex min-h-11 items-center font-semibold"
        >
          Abrir gastos
        </a>
      </Card>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Cierre
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          El cierre de caja sigue en la app. Aqui va el historial.
        </p>
        <a
          href="/app/cierre"
          className="mt-4 inline-flex min-h-11 items-center font-semibold"
        >
          Ver cierres
        </a>
      </Card>
    </div>
  );
}
