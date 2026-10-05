"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getWorkspaceSession,
  hasOwnerModeAdminBackup,
  restoreOwnerModeAdminSession,
} from "@/lib/auth";
import { Button } from "@/components/inbox/ui";

export default function OwnerDashboardSelectPage() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [hasAdminBackup, setHasAdminBackup] = useState(false);

  useEffect(() => {
    const session = getWorkspaceSession();
    setWorkspaceName(session?.currentWorkspace.name ?? "Workspace");
    setHasAdminBackup(hasOwnerModeAdminBackup());
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Vista owner
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 md:text-3xl">
              Elige dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {workspaceName}. Dashboard 1 es el panel actual. Dashboard 2 es la
              version nueva, solo con negocios dados de alta.
            </p>
          </div>
          {hasAdminBackup ? (
            <Button
              variant="secondary"
              onClick={() => {
                restoreOwnerModeAdminSession();
                router.push("/admin");
              }}
            >
              Volver a superowner
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/main/home")}
            className="min-h-44 rounded-xl border border-slate-200 bg-white p-6 text-left hover:border-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Actual
            </p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">
              Dashboard 1
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Panel completo: conversaciones, automatizacion, horarios, users y
              configuracion.
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push("/owner")}
            className="min-h-44 rounded-xl border border-slate-200 bg-white p-6 text-left hover:border-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Nuevo
            </p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">
              Dashboard 2
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Lista solamente los negocios dados de alta en este workspace.
            </p>
          </button>
        </div>
      </div>
    </main>
  );
}
