"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  clearAdminSession,
  getWorkspaceSession,
  hasOwnerModeAdminBackup,
  restoreOwnerModeAdminSession,
  saveOwnerModeSession,
  type WorkspaceSession,
} from "@/lib/auth";
import {
  readLastSelectedWorkspaceId,
  switchClientWorkspace,
  writeLastSelectedWorkspaceId,
} from "@/lib/owner-business";
import { takuAdminApi, takuAdminList, takuPaginated } from "@/lib/taku-api";
import { cx } from "@/components/inbox/helpers";
import { Button } from "@/components/inbox/ui";
import type { OwnerWhatsAppNumber } from "./WhatsAppNumbersCard";

export type OwnerTenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  timezone?: string;
};

type AdminWorkspace = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
};

export function OwnerShell({
  headerLabel,
  children,
}: {
  headerLabel: string;
  children: (state: {
    tenants: OwnerTenant[];
    selected: OwnerTenant | null;
    numbers: OwnerWhatsAppNumber[];
    isLoading: boolean;
    error: string | null;
    refreshNumbers: () => void;
  }) => ReactNode;
}) {
  const router = useRouter();
  const [hasAdminBackup, setHasAdminBackup] = useState(false);
  const [tenants, setTenants] = useState<OwnerTenant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<OwnerWhatsAppNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [numbersKey, setNumbersKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedId) ?? null,
    [selectedId, tenants],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTenants() {
      const session = getWorkspaceSession();
      const adminBackup = hasOwnerModeAdminBackup();
      setHasAdminBackup(adminBackup);
      if (!session) {
        setIsLoading(false);
        return;
      }

      let nextTenants: OwnerTenant[] = session.workspaces;
      if (adminBackup) {
        try {
          const adminWorkspaces = await takuAdminList<AdminWorkspace>(
            "/admin/workspaces?pageSize=100",
          );
          nextTenants = adminWorkspaces.map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            status: item.status,
            plan: item.plan,
          }));
        } catch {
          nextTenants = session.workspaces;
        }
      }

      const stored = readLastSelectedWorkspaceId();
      let nextId =
        nextTenants.find((item) => item.id === stored)?.id ??
        nextTenants.find((item) => item.id === session.currentWorkspace.id)
          ?.id ??
        nextTenants[0]?.id ??
        null;

      if (nextId && nextId !== session.currentWorkspace.id) {
        try {
          if (adminBackup) {
            const ownerSession = await takuAdminApi<WorkspaceSession>(
              `/admin/workspaces/${nextId}/owner-session`,
              { method: "POST" },
            );
            saveOwnerModeSession(ownerSession);
          } else {
            switchClientWorkspace(nextId);
          }
        } catch {
          nextId = session.currentWorkspace.id;
        }
      }

      if (cancelled) return;
      setTenants(nextTenants);
      setSelectedId(nextId);
      if (nextId) writeLastSelectedWorkspaceId(nextId);
      setIsLoading(false);
    }

    void loadTenants();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setNumbers([]);
      return;
    }
    let cancelled = false;
    void takuPaginated<OwnerWhatsAppNumber>("/whatsapp-accounts?pageSize=100")
      .then((result) => {
        if (cancelled) return;
        setNumbers(result.items.filter((item) => item.status !== "disabled"));
        setError(null);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cargar los numeros.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [numbersKey, selectedId]);

  async function selectTenant(tenantId: string) {
    if (tenantId === selectedId) {
      router.push("/owner");
      return;
    }
    setIsSwitching(true);
    setError(null);
    try {
      if (hasOwnerModeAdminBackup()) {
        const ownerSession = await takuAdminApi<WorkspaceSession>(
          `/admin/workspaces/${tenantId}/owner-session`,
          { method: "POST" },
        );
        saveOwnerModeSession(ownerSession);
      } else if (!switchClientWorkspace(tenantId)) {
        throw new Error("No tienes acceso a ese tenant.");
      }
      writeLastSelectedWorkspaceId(tenantId);
      setSelectedId(tenantId);
      router.push("/owner");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cambiar de tenant.",
      );
    } finally {
      setIsSwitching(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Owner v2
            </p>
            <h1 className="mt-2 text-lg font-semibold text-slate-950">
              Tenants
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {selected?.name ?? "Selecciona un tenant"}
            </p>
          </div>
          <nav className="grid gap-1 p-4">
            {isLoading ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-600">
                Cargando tenants...
              </div>
            ) : tenants.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No hay tenants disponibles.
              </div>
            ) : (
              tenants.map((tenant) => {
                const active = tenant.id === selectedId;
                return (
                  <button
                    key={tenant.id}
                    type="button"
                    disabled={isSwitching}
                    onClick={() => void selectTenant(tenant.id)}
                    className={cx(
                      "min-h-11 rounded-lg px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:opacity-50",
                      active
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {tenant.name}
                    </span>
                    <span
                      className={cx(
                        "mt-1 block text-xs",
                        active ? "text-slate-300" : "text-slate-500",
                      )}
                    >
                      {tenant.plan} · {tenant.status}
                    </span>
                  </button>
                );
              })
            )}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {headerLabel}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {selected?.name ?? "Selecciona un tenant"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearAdminSession();
                    router.replace("/login");
                  }}
                >
                  Logout
                </Button>
              </div>
            </div>
          </header>
          <div className="p-4 md:p-6">
            {children({
              tenants,
              selected,
              numbers,
              isLoading: isLoading || isSwitching,
              error,
              refreshNumbers: () => setNumbersKey((current) => current + 1),
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
