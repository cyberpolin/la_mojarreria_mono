"use client";

import { useEffect, useMemo, useState } from "react";
import { addGroupConversation, fetchAccountGroups } from "./api";
import type { WhatsAppGroupOption } from "./api";
import { accountStatusLabel, isAccountConnected } from "./helpers";
import type { InboxConversation, InboxWhatsAppAccount } from "./types";
import { Button } from "./ui";

export function AddGroupModal({
  accounts,
  onClose,
  onAdded,
}: {
  accounts: InboxWhatsAppAccount[];
  onClose: () => void;
  onAdded: (conversation: InboxConversation) => void;
}) {
  const connected = useMemo(
    () => accounts.filter((account) => isAccountConnected(account.status)),
    [accounts],
  );
  const [accountId, setAccountId] = useState(connected[0]?.id ?? "");
  const [groups, setGroups] = useState<WhatsAppGroupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) {
      setGroups([]);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchAccountGroups(accountId)
      .then((rows) => {
        setGroups(rows);
      })
      .catch((caught: unknown) => {
        setGroups([]);
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudieron cargar los grupos.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [accountId]);

  async function addGroup(group: WhatsAppGroupOption) {
    if (!accountId || group.pinned) return;
    setAddingId(group.id);
    setError(null);
    try {
      const conversation = await addGroupConversation({
        whatsappAccountId: accountId,
        groupJid: group.id,
        name: group.subject,
      });
      onAdded(conversation);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo agregar el grupo.",
      );
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 p-4">
      <div className="grid w-full max-w-lg gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Agregar grupo
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Solo el grupo fijado aparece en el chat. Elige el de repartidores.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center text-lg text-slate-500"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {connected.length === 0 ? (
          <p className="text-sm text-slate-600">
            No hay numeros conectados. Conecta un WhatsApp para ver grupos.
          </p>
        ) : (
          <>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Telefono
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950"
              >
                {connected.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName} ·{" "}
                    {account.phoneNumber ?? "Sin numero"} ·{" "}
                    {accountStatusLabel(account.status)}
                  </option>
                ))}
              </select>
            </label>
            {error ? <p className="text-sm text-slate-700">{error}</p> : null}
            <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
              {loading ? (
                <p className="p-4 text-sm text-slate-500">Cargando grupos...</p>
              ) : null}
              {!loading && groups.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">
                  Este numero no tiene grupos visibles.
                </p>
              ) : null}
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  disabled={group.pinned || addingId === group.id}
                  onClick={() => void addGroup(group)}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {group.subject}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {group.size} participantes
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-700">
                    {group.pinned
                      ? "Fijado"
                      : addingId === group.id
                        ? "Fijando..."
                        : group.added
                          ? "Fijar"
                          : "Agregar y fijar"}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
