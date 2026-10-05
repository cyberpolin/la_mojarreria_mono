"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getWorkspaceSession,
  hasOwnerModeAdminBackup,
  restoreOwnerModeAdminSession,
} from "@/lib/auth";
import { takuPaginated } from "@/lib/taku-api";
import { Badge, Button } from "@/components/inbox/ui";

type OwnerBusiness = {
  id: string;
  displayName: string;
  description?: string | null;
  phoneNumber: string | null;
  status: string;
  enabled?: boolean;
  automationEnabled?: boolean;
};

function statusLabel(status: string) {
  if (status === "connected") return "Conectado";
  if (status === "disconnected") return "Desconectado";
  if (status === "qr_required") return "QR requerido";
  if (status === "connecting") return "Conectando";
  if (status === "failed") return "Fallido";
  if (status === "disabled") return "Deshabilitado";
  return status;
}

function formatPhone(phone: string | null) {
  if (!phone) return "Sin numero";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return phone;
  return digits.slice(-10);
}

export default function OwnerDashboardV2Page() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [hasAdminBackup, setHasAdminBackup] = useState(false);
  const [businesses, setBusinesses] = useState<OwnerBusiness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getWorkspaceSession();
    setWorkspaceName(session?.currentWorkspace.name ?? "Workspace");
    setHasAdminBackup(hasOwnerModeAdminBackup());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void takuPaginated<OwnerBusiness>("/whatsapp-accounts?pageSize=100")
      .then((result) => {
        if (cancelled) return;
        setBusinesses(
          result.items.filter((item) => item.status !== "disabled"),
        );
        setError(null);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cargar los negocios.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Owner dashboard v2
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 md:text-3xl">
              Negocios
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {workspaceName}. Solo aparecen los negocios dados de alta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => router.push("/owner/select")}
            >
              Cambiar dashboard
            </Button>
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
        </div>

        {error ? (
          <div className="rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-700">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-700">
            Cargando negocios...
          </div>
        ) : businesses.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
            No hay negocios dados de alta.
          </div>
        ) : (
          <section className="grid gap-4">
            {businesses.map((business) => {
              const connected = business.status === "connected";
              return (
                <article
                  key={business.id}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-950">
                          {business.displayName}
                        </h2>
                        <Badge tone={connected ? "dark" : "warn"}>
                          {statusLabel(business.status)}
                        </Badge>
                        {business.automationEnabled ? (
                          <Badge>Automatizacion</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {formatPhone(business.phoneNumber)}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        const phone = (business.phoneNumber ?? "").replace(
                          /\D/g,
                          "",
                        );
                        router.push(
                          phone
                            ? `/conversation-mobile/${phone}`
                            : "/conversation-mobile",
                        );
                      }}
                    >
                      Abrir inbox
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
