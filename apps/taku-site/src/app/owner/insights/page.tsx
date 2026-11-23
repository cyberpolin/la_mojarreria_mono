"use client";

import { InsightsDashboard } from "@/components/insights/InsightsDashboard";
import { OwnerShell } from "../OwnerShell";

export default function OwnerInsightsPage() {
  return (
    <OwnerShell headerLabel="Analisis">
      {({ selected, isLoading, error }) => {
        if (error) {
          return (
            <div className="rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-700">
              {error}
            </div>
          );
        }
        if (isLoading) {
          return (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-700">
              Cargando tenant...
            </div>
          );
        }
        if (!selected) {
          return (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-600">
              Selecciona un tenant en el menu lateral.
            </div>
          );
        }
        return <InsightsDashboard key={selected.id} />;
      }}
    </OwnerShell>
  );
}
