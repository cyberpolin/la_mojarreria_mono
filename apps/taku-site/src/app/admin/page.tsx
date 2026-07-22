"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminSession,
  saveOwnerModeSession,
  type AdminUser,
  type WorkspaceSession,
} from "@/lib/auth";
import { takuAdminApi, takuAdminList } from "@/lib/taku-api";

const metrics = [
  ["Workspaces activos", "18"],
  ["Workspaces trial", "7"],
  ["Workspaces suspendidos", "2"],
  ["Numeros conectados", "31"],
  ["Webhooks fallidos", "4"],
  ["Errores ultimos 60 min", "3"],
];

type AdminWorkspace = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  users: number;
  whatsappAccounts: number;
  connectedWhatsappAccounts: number;
  lastActivityAt: string | null;
};

const nav = [
  "Overview",
  "Workspaces",
  "WhatsApp Accounts",
  "Users",
  "Webhooks",
  "Logs",
  "Usage",
  "Plans",
  "Billing",
  "Admin Users",
  "Settings",
];

function Badge({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <span
      className={
        dark
          ? "inline-flex min-h-7 items-center rounded-full bg-slate-950 px-3 text-xs font-semibold text-white"
          : "inline-flex min-h-7 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700"
      }
    >
      {children}
    </span>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setAdminUser(getAdminSession()?.adminUser ?? null);
    void takuAdminList<AdminWorkspace>("/admin/workspaces")
      .then(setWorkspaces)
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cargar workspaces.",
        ),
      );
  }, []);

  async function openAsOwner(workspaceId: string) {
    setOpeningWorkspaceId(workspaceId);
    setError(null);
    try {
      const session = await takuAdminApi<WorkspaceSession>(
        `/admin/workspaces/${workspaceId}/owner-session`,
        { method: "POST" },
      );
      saveOwnerModeSession(session);
      router.push("/main");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo abrir como owner.",
      );
    } finally {
      setOpeningWorkspaceId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <img
                src="/taku.png"
                alt="TAKU"
                className="h-10 w-10 rounded-lg border border-slate-200"
              />
              <div>
                <p className="text-sm font-bold tracking-[0.18em]">TAKU</p>
                <p className="text-xs text-slate-500">Super Admin</p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-950">
                {adminUser?.name ?? "Super Admin"}
              </p>
              <p className="mt-1 break-all text-xs text-slate-500">
                {adminUser?.email ?? "Sesion activa"}
              </p>
              <div className="mt-3">
                <Badge dark>{adminUser?.role ?? "super_owner"}</Badge>
              </div>
            </div>
          </div>

          <nav className="grid gap-1 p-4">
            {nav.map((item, index) => (
              <button
                key={item}
                type="button"
                className={
                  index === 0
                    ? "min-h-11 rounded-lg bg-slate-950 px-3 text-left text-sm font-semibold text-white"
                    : "min-h-11 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                }
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Panel interno
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                  Overview global
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  placeholder="Buscar workspace, usuario, numero..."
                  className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 sm:w-80"
                />
                <Badge>Servicios OK</Badge>
                <Badge dark>{adminUser?.role ?? "super_owner"}</Badge>
                <button
                  type="button"
                  disabled={!workspaces[0] || Boolean(openingWorkspaceId)}
                  onClick={() => {
                    const workspace = workspaces[0];
                    if (workspace) void openAsOwner(workspace.id);
                  }}
                  className="min-h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {openingWorkspaceId ? "Abriendo owner..." : "Ver como owner"}
                </button>
              </div>
            </div>
          </header>

          <div className="grid gap-6 p-4 md:p-6">
            {error ? (
              <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700">
                {error}
              </div>
            ) : null}
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {metrics.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-4">
                  <h2 className="font-semibold text-slate-950">Workspaces</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Vista global de clientes para soporte y operacion.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Usuarios</th>
                        <th className="px-4 py-3">Numeros</th>
                        <th className="px-4 py-3">Actividad</th>
                        <th className="px-4 py-3">Owner UI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {workspaces.map((workspace) => (
                        <tr key={workspace.slug}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-950">
                              {workspace.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {workspace.slug}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge dark={workspace.status === "active"}>
                              {workspace.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {workspace.plan}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {workspace.users}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {workspace.connectedWhatsappAccounts}/
                            {workspace.whatsappAccounts}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {workspace.lastActivityAt
                              ? new Intl.DateTimeFormat("es-MX", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                }).format(new Date(workspace.lastActivityAt))
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              disabled={openingWorkspaceId === workspace.id}
                              onClick={() => void openAsOwner(workspace.id)}
                              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {openingWorkspaceId === workspace.id
                                ? "Abriendo..."
                                : "Abrir como owner"}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {workspaces.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-8 text-sm text-slate-500"
                            colSpan={7}
                          >
                            No hay workspaces disponibles.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-6">
                <section className="rounded-lg border border-slate-200 bg-white p-5">
                  <h2 className="font-semibold text-slate-950">
                    Estado de servicios
                  </h2>
                  <div className="mt-4 grid gap-3 text-sm">
                    {[
                      "PostgreSQL",
                      "WhatsApp Service API",
                      "Bot Service API",
                      "Realtime",
                      "Background Jobs",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <span className="font-medium text-slate-700">
                          {item}
                        </span>
                        <Badge dark>OK</Badge>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5">
                  <h2 className="font-semibold text-slate-950">
                    Alertas criticas
                  </h2>
                  <div className="mt-4 grid gap-3 text-sm text-slate-700">
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      Taller Norte esta suspendido por falta de pago.
                    </p>
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      Hay 4 webhooks fallidos pendientes de revision.
                    </p>
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      La Mojarreria tiene un numero desconectado.
                    </p>
                  </div>
                </section>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
