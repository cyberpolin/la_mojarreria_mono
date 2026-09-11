"use client";

import {
  accountStatusLabel,
  conversationStatusLabel,
  formatDate,
} from "./helpers";
import type {
  InboxBlockedContact,
  InboxConversation,
  InboxUser,
} from "./types";
import { Badge, Button, Field, Input, Select, Switch, TextArea } from "./ui";

export function ConversationRail({
  conversation,
  users,
  blockedContact,
  contactName,
  contactNotes,
  isSavingContact,
  isSavingAssignment,
  isSavingStatus,
  isSavingAutomationBlock,
  error,
  onContactNameChange,
  onContactNotesChange,
  onSaveContact,
  onAssign,
  onStatus,
  onToggleAutomation,
}: {
  conversation: InboxConversation | null;
  users: InboxUser[];
  blockedContact: InboxBlockedContact | null;
  contactName: string;
  contactNotes: string;
  isSavingContact: boolean;
  isSavingAssignment: boolean;
  isSavingStatus: boolean;
  isSavingAutomationBlock: boolean;
  error: string | null;
  onContactNameChange: (value: string) => void;
  onContactNotesChange: (value: string) => void;
  onSaveContact: () => void;
  onAssign: (userId: string | null) => void;
  onStatus: (status: "open" | "closed" | "archived") => void;
  onToggleAutomation: (enabled: boolean) => void;
}) {
  const status = conversation?.status ?? "open";
  const canReopen = status === "closed" || status === "archived";

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-950">Detalles TAKU</h2>
      {!conversation ? (
        <p className="mt-4 text-sm text-slate-500">
          Selecciona una conversacion para ver contacto, asignacion y estado.
        </p>
      ) : (
        <div className="mt-4 grid gap-5">
          {error ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
              {error}
            </div>
          ) : null}

          <section className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Contacto
            </p>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Telefono
                </dt>
                <dd className="mt-1 text-slate-800">
                  {conversation.contact?.phoneNumber ?? "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Numero WhatsApp
                </dt>
                <dd className="mt-1 text-slate-800">
                  {conversation.whatsappAccount?.displayName ?? "-"}
                  <span className="mt-1 block text-xs text-slate-500">
                    {accountStatusLabel(
                      conversation.whatsappAccount?.status ?? "pending",
                    )}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Ultima actividad
                </dt>
                <dd className="mt-1 text-slate-800">
                  {formatDate(conversation.lastMessageAt)}
                </dd>
              </div>
            </dl>
            <Field label="Nombre del contacto">
              <Input
                placeholder="Nombre del cliente"
                value={contactName}
                onChange={onContactNameChange}
              />
            </Field>
            <Field label="Notas internas">
              <TextArea
                placeholder="Notas visibles solo para el equipo"
                rows={3}
                value={contactNotes}
                onChange={onContactNotesChange}
              />
            </Field>
            <Button
              disabled={!conversation.contact || isSavingContact}
              onClick={onSaveContact}
            >
              {isSavingContact ? "Guardando..." : "Guardar contacto"}
            </Button>
          </section>

          <section className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Asignacion
            </p>
            <Select
              value={conversation.assignedUser?.id ?? ""}
              disabled={isSavingAssignment}
              onChange={(value) => onAssign(value || null)}
            >
              <option value="">Sin asignar</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </section>

          <section className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Estado
            </p>
            <div>
              <Badge tone={status === "open" ? "dark" : "default"}>
                {conversationStatusLabel(status)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {canReopen ? (
                <Button
                  variant="secondary"
                  disabled={isSavingStatus}
                  onClick={() => onStatus("open")}
                >
                  Reabrir
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={isSavingStatus}
                  onClick={() => onStatus("closed")}
                >
                  Cerrar
                </Button>
              )}
              {status !== "archived" ? (
                <Button
                  variant="secondary"
                  disabled={isSavingStatus}
                  onClick={() => onStatus("archived")}
                >
                  Archivar
                </Button>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Automatizacion
            </p>
            <Switch
              checked={blockedContact?.enabled ?? false}
              disabled={!conversation.contact || isSavingAutomationBlock}
              label={
                isSavingAutomationBlock
                  ? "Guardando bloqueo..."
                  : "Bloquear automatizacion"
              }
              onChange={onToggleAutomation}
            />
            <p className="text-xs leading-5 text-slate-500">
              Si esta activo, TAKU guarda la conversacion pero no responde con
              reglas ni bot a este contacto.
            </p>
          </section>
        </div>
      )}
    </aside>
  );
}
