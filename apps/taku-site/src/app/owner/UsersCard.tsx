"use client";

import { useEffect, useState } from "react";
import { getWorkspaceSession, takuApi, takuPaginated } from "@/lib/taku-api";
import { Badge, Button, Field, Input, Select } from "@/components/inbox/ui";

export type OwnerUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt?: string;
};

type UserForm = {
  name: string;
  email: string;
  role: "owner" | "agent";
  password: string;
};

const EMPTY_FORM: UserForm = {
  name: "",
  email: "",
  role: "agent",
  password: "",
};

function roleLabel(role: string) {
  if (role === "owner") return "Owner";
  if (role === "agent") return "Agente";
  return role;
}

function statusLabel(status: string) {
  if (status === "active") return "Activo";
  if (status === "disabled") return "Desactivado";
  if (status === "invited") return "Invitado";
  return status;
}

export function UsersCard() {
  const [users, setUsers] = useState<OwnerUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<OwnerUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const currentUserId = getWorkspaceSession()?.user.id ?? null;

  async function loadUsers() {
    setIsLoading(true);
    try {
      const result = await takuPaginated<OwnerUser>("/users?pageSize=100");
      setUsers(result.items);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudieron cargar los usuarios.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setMode("create");
  }

  function openEdit(user: OwnerUser) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role === "owner" ? "owner" : "agent",
      password: "",
    });
    setError(null);
    setMode("edit");
  }

  async function save() {
    if (saving) return;
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name || !email) {
      setError("Nombre y email son requeridos.");
      return;
    }
    if (mode === "create" && form.password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres.");
      return;
    }
    if (mode === "edit" && form.password && form.password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        await takuApi<OwnerUser>("/users", {
          method: "POST",
          body: JSON.stringify({
            name,
            email,
            role: form.role,
            password: form.password,
            status: "active",
          }),
        });
      } else if (editing) {
        await takuApi<OwnerUser>(`/users/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            role: form.role,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
      }
      setMode(null);
      setEditing(null);
      await loadUsers();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el usuario.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: OwnerUser) {
    if (togglingId || user.id === currentUserId) return;
    const nextStatus = user.status === "active" ? "disabled" : "active";
    setTogglingId(user.id);
    setError(null);
    try {
      await takuApi(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadUsers();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar el estado.",
      );
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Usuarios
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          <span aria-hidden="true">+</span>
          Agregar usuario
        </button>
      </div>

      {isLoading ? (
        <div className="mt-5 flex min-h-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <span
            role="status"
            aria-label="Cargando usuarios"
            className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950"
          />
        </div>
      ) : users.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          Este tenant no tiene usuarios.
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-950">
                    {user.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{user.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{roleLabel(user.role)}</Badge>
                    <Badge tone={user.status === "active" ? "dark" : "default"}>
                      {statusLabel(user.status)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => openEdit(user)}>
                    Editar
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={
                      togglingId === user.id || user.id === currentUserId
                    }
                    onClick={() => void toggleStatus(user)}
                  >
                    {togglingId === user.id
                      ? "..."
                      : user.status === "active"
                        ? "Desactivar"
                        : "Activar"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !mode ? (
        <p className="mt-4 text-sm text-slate-700">{error}</p>
      ) : null}

      {mode ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-950">
              {mode === "create" ? "Agregar usuario" : "Editar usuario"}
            </h2>
            <div className="mt-5 grid gap-4">
              <Field label="Nombre">
                <Input
                  placeholder="Nombre"
                  value={form.name}
                  onChange={(name) =>
                    setForm((current) => ({ ...current, name }))
                  }
                />
              </Field>
              <Field label="Email">
                <Input
                  placeholder="correo@negocio.com"
                  type="email"
                  value={form.email}
                  onChange={(email) =>
                    setForm((current) => ({ ...current, email }))
                  }
                  readOnly={mode === "edit"}
                />
              </Field>
              <Field label="Rol">
                <Select
                  value={form.role}
                  onChange={(role) =>
                    setForm((current) => ({
                      ...current,
                      role: role === "owner" ? "owner" : "agent",
                    }))
                  }
                >
                  <option value="agent">Agente</option>
                  <option value="owner">Owner</option>
                </Select>
              </Field>
              <Field
                label={mode === "create" ? "Contrasena" : "Nueva contrasena"}
                hint={
                  mode === "edit"
                    ? "Dejala vacia si no quieres cambiarla."
                    : "Minimo 8 caracteres. El agente entra con esta clave al app."
                }
              >
                <Input
                  placeholder="********"
                  type="password"
                  value={form.password}
                  onChange={(password) =>
                    setForm((current) => ({ ...current, password }))
                  }
                />
              </Field>
            </div>
            {error ? (
              <p className="mt-4 text-sm text-slate-700">{error}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setMode(null);
                  setEditing(null);
                  setError(null);
                }}
              >
                Cancelar
              </Button>
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
