"use client";

import { useEffect, useState } from "react";
import { takuApi } from "@/lib/taku-api";
import { formatDate } from "@/components/inbox/helpers";
import { Button, Field, Input, Select, TextArea } from "@/components/inbox/ui";
import { timezoneOptions } from "./AddNumberForm";

export type OwnerWhatsAppAccount = {
  id: string;
  displayName: string;
  description: string | null;
  phoneNumber: string | null;
  status: string;
  timezone: string;
  enabled: boolean;
  useWorkspaceBusinessHours: boolean;
  useWorkspaceBotSettings: boolean;
};

export function NumberForms({
  account,
  onAccountChange,
}: {
  account: OwnerWhatsAppAccount;
  onAccountChange: () => void | Promise<void>;
}) {
  const [qr, setQr] = useState<{
    payload?: string | null;
    imageUrl?: string | null;
    expiresAt?: string | null;
  } | null>(null);
  const [pairing, setPairing] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState(account.displayName);
  const [editDescription, setEditDescription] = useState(
    account.description ?? "",
  );
  const [editTimezone, setEditTimezone] = useState(account.timezone);
  const [savingSelected, setSavingSelected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedIsConnected = account.status === "connected";

  useEffect(() => {
    setEditDisplayName(account.displayName);
    setEditDescription(account.description ?? "");
    setEditTimezone(account.timezone);
  }, [account.description, account.displayName, account.id, account.timezone]);

  useEffect(() => {
    if (!qr || selectedIsConnected) {
      setPairing(false);
      return;
    }

    let cancelled = false;
    setPairing(true);
    setPairingStatus("Esperando vinculacion...");

    async function syncStatus() {
      try {
        const synced = await takuApi<OwnerWhatsAppAccount>(
          `/whatsapp-accounts/${account.id}/sync`,
          { method: "POST" },
        );
        if (cancelled) return;
        if (synced.status === "connected") {
          setPairing(false);
          setPairingStatus("Conectado");
          setQr(null);
          setMessage("Numero conectado correctamente.");
          onAccountChange();
        }
      } catch {
        if (!cancelled) {
          setPairingStatus("Seguimos esperando la vinculacion...");
        }
      }
    }

    void syncStatus();
    const interval = window.setInterval(() => void syncStatus(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [account.id, onAccountChange, qr, selectedIsConnected]);

  async function requestQr() {
    setMessage(null);
    try {
      const response = await takuApi<{
        id: string;
        status: string;
        qr: {
          payload?: string | null;
          imageUrl?: string | null;
          expiresAt?: string | null;
        };
      }>(`/whatsapp-accounts/${account.id}/connect`, { method: "POST" });
      setQr(response.qr);
      setPairing(true);
      setPairingStatus("Esperando vinculacion...");
      setMessage(
        "QR solicitado. Si no aparece, intenta regenerarlo en unos segundos.",
      );
      onAccountChange();
    } catch (error) {
      setQr(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo comunicar con WhatsApp Service.",
      );
    }
  }

  async function updateSelected() {
    setSavingSelected(true);
    setMessage(null);
    try {
      await takuApi(`/whatsapp-accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: editDisplayName,
          description: editDescription,
          timezone: editTimezone,
          enabled: account.enabled,
          useWorkspaceBusinessHours: account.useWorkspaceBusinessHours,
          useWorkspaceBotSettings: account.useWorkspaceBotSettings,
        }),
      });
      setMessage("Cambios del numero guardados.");
      onAccountChange();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el numero.",
      );
    } finally {
      setSavingSelected(false);
    }
  }

  return (
    <div className="grid gap-6">
      {message ? (
        <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Conectar numero por QR
          </h2>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
            {selectedIsConnected ? (
              <div className="mx-auto grid h-56 w-56 place-items-center rounded-lg border border-slate-300 bg-white p-5 text-center">
                <div>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-950 text-2xl font-semibold text-white">
                    ✓
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-950">
                    Conectado
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {account.phoneNumber ?? "WhatsApp vinculado"}
                  </p>
                </div>
              </div>
            ) : qr?.imageUrl ? (
              <img
                src={qr.imageUrl}
                alt="WhatsApp QR"
                className="mx-auto h-56 w-56 rounded-lg border border-slate-300 bg-white object-contain"
              />
            ) : qr?.payload ? (
              <div className="mx-auto grid h-56 w-56 place-items-center rounded-lg border border-slate-300 bg-white p-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                QR recibido sin imagen. Regenera el QR en unos segundos.
              </div>
            ) : (
              <div className="mx-auto grid h-56 w-56 place-items-center rounded-lg border border-slate-300 bg-white p-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Pide o regenera el QR
              </div>
            )}
            <p className="mt-4 font-semibold text-slate-950">
              {selectedIsConnected
                ? "Numero conectado"
                : "Escanea este codigo QR con WhatsApp"}
            </p>
            {selectedIsConnected ? (
              <p className="mx-auto mt-3 max-w-sm text-sm text-slate-600">
                La vinculacion ya esta activa para este workspace.
              </p>
            ) : (
              <ol className="mx-auto mt-3 max-w-sm list-decimal space-y-1 pl-5 text-left text-sm text-slate-600">
                <li>Abre WhatsApp en tu telefono.</li>
                <li>Ve a Dispositivos vinculados.</li>
                <li>Toca Vincular dispositivo.</li>
                <li>Escanea el codigo QR.</li>
              </ol>
            )}
            {pairing && pairingStatus ? (
              <p className="mt-3 text-xs font-semibold text-slate-600">
                {pairingStatus}
              </p>
            ) : null}
            {qr?.expiresAt ? (
              <p className="mt-3 text-xs text-slate-500">
                Expira: {formatDate(qr.expiresAt)}
              </p>
            ) : null}
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={() => void requestQr()}>Regenerar QR</Button>
              <Button variant="secondary" onClick={() => setQr(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Configurar numero</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Nombre del numero">
              <Input
                placeholder="Ej. Ventas"
                value={editDisplayName}
                onChange={setEditDisplayName}
              />
            </Field>
            <Field label="Descripcion interna">
              <TextArea
                placeholder="Descripcion visible para el equipo"
                value={editDescription}
                onChange={setEditDescription}
              />
            </Field>
            <Field
              label="Zona horaria"
              hint="TAKU envia esta hora al bot en cada respuesta automatica."
            >
              <Select value={editTimezone} onChange={setEditTimezone}>
                {timezoneOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Numero: {account.phoneNumber ?? "Sin vincular"}
            </div>
            <Button
              disabled={!editDisplayName.trim() || savingSelected}
              onClick={() => void updateSelected()}
            >
              {savingSelected ? "Guardando..." : "Guardar numero"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
