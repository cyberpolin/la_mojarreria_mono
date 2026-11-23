"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createConversation, updateContact } from "./api";
import type { InboxConversation, InboxWhatsAppAccount } from "./types";

function modalHost() {
  return document.getElementById("taku-mobile-window") ?? document.body;
}

export function EditContactModal({
  conversation,
  phone,
  account,
  onClose,
  onSaved,
}: {
  conversation: InboxConversation | null;
  phone: string;
  account?: InboxWhatsAppAccount | null;
  onClose: () => void;
  onSaved: (conversation: InboxConversation) => void;
}) {
  const [name, setName] = useState(conversation?.contact?.name ?? "");
  const [notes, setNotes] = useState(conversation?.contact?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = typeof document !== "undefined" ? modalHost() : null;

  useEffect(() => {
    setName(conversation?.contact?.name ?? "");
    setNotes(conversation?.contact?.notes ?? "");
  }, [
    conversation?.contact?.id,
    conversation?.contact?.name,
    conversation?.contact?.notes,
  ]);

  if (!host) return null;

  async function handleSave() {
    const nextName = name.trim();
    if (!nextName) {
      setError("Escribe el nombre del contacto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let current = conversation;
      if (!current?.contact?.id) {
        current = await createConversation({
          phoneNumber: phone,
          name: nextName,
          whatsappAccountId:
            conversation?.whatsappAccount?.id ?? account?.id ?? undefined,
        });
      }
      if (!current.contact?.id) {
        throw new Error("No se pudo abrir el contacto.");
      }
      const contact = await updateContact(current.contact.id, {
        name: nextName,
        notes: notes.trim(),
      });
      onSaved({
        ...current,
        contact: {
          ...current.contact,
          ...contact,
          name: contact?.name ?? nextName,
          notes: contact?.notes ?? notes.trim(),
        },
      });
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar el contacto.",
      );
    } finally {
      setSaving(false);
    }
  }

  const overlayClass =
    host.id === "taku-mobile-window"
      ? "absolute inset-0 z-[90] flex flex-col bg-white"
      : "fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4";

  return createPortal(
    <div className={overlayClass}>
      <div
        className={
          host.id === "taku-mobile-window"
            ? "flex min-h-0 flex-1 flex-col"
            : "flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        }
      >
        <header className="flex items-center gap-2 border-b border-slate-200 px-2 py-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center text-lg"
            aria-label="Regresar"
          >
            ←
          </button>
          <h2 className="text-base font-semibold text-slate-950">
            Editar contacto
          </h2>
        </header>
        <form
          className="grid gap-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Telefono
            <input
              readOnly
              value={conversation?.contact?.phoneNumber || phone}
              className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Nombre
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del contacto"
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Notas internas
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notas visibles solo para el equipo"
              className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
            />
          </label>
          {error ? <p className="text-sm text-slate-700">{error}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>,
    host,
  );
}
