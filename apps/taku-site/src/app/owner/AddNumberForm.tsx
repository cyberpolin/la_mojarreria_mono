"use client";

import { FormEvent, useState } from "react";
import { takuApi } from "@/lib/taku-api";
import {
  Button,
  Field,
  Input,
  Select,
  Switch,
  TextArea,
} from "@/components/inbox/ui";

export const timezoneOptions = [
  "America/Mexico_City",
  "America/Cancun",
  "America/Monterrey",
  "America/Mazatlan",
  "America/Chihuahua",
  "America/Hermosillo",
  "America/Tijuana",
  "America/Bogota",
  "America/Lima",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export function AddNumberForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (accountId: string) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState("America/Mexico_City");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setCreating(true);
    try {
      const response = await takuApi<{
        id: string;
        provisioningWarning?: string | null;
      }>("/whatsapp-accounts", {
        method: "POST",
        body: JSON.stringify({
          displayName,
          description,
          timezone,
        }),
      });
      setDisplayName("");
      setDescription("");
      setTimezone("America/Mexico_City");
      onCreated(response.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear el numero.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={createNumber} className="grid gap-4">
      {message ? (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}
      <Field label="Nombre del numero">
        <Input
          placeholder="Ej. Ventas, Soporte, Sucursal Centro"
          value={displayName}
          onChange={setDisplayName}
        />
      </Field>
      <Field label="Descripcion interna">
        <TextArea
          placeholder="Ej. Numero principal para pedidos y cotizaciones"
          value={description}
          onChange={setDescription}
        />
      </Field>
      <Field label="Zona horaria">
        <Select value={timezone} onChange={setTimezone}>
          {timezoneOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>
      <Switch checked label="Usar horario general de la empresa" />
      <Switch checked label="Usar configuracion general del bot" />
      <div className="flex gap-3">
        <Button type="submit" disabled={!displayName.trim() || creating}>
          {creating ? "Creando..." : "Crear numero"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function AddNumberModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (accountId: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-number-title"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl md:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="add-number-title"
          className="text-lg font-semibold text-slate-950"
        >
          Agregar numero
        </h2>
        <div className="mt-5">
          <AddNumberForm onCancel={onClose} onCreated={onCreated} />
        </div>
      </div>
    </div>
  );
}
