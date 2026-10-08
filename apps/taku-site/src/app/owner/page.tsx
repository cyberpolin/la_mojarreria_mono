"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { takuApi } from "@/lib/taku-api";
import { Button } from "@/components/inbox/ui";
import { AddNumberModal } from "./AddNumberForm";
import { OwnerShell } from "./OwnerShell";
import { DriversGroupModeCard } from "./DriversGroupModeCard";
import {
  WhatsAppNumbersCard,
  type OwnerWhatsAppNumber,
} from "./WhatsAppNumbersCard";

export default function OwnerDashboardV2Page() {
  const router = useRouter();
  const [isAddingNumber, setIsAddingNumber] = useState(false);
  const [deleting, setDeleting] = useState<OwnerWhatsAppNumber | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <OwnerShell headerLabel="Informacion general">
      {({ selected, numbers, isLoading, error, refreshNumbers }) => {
        if (error) {
          return (
            <div className="rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-700">
              {error}
            </div>
          );
        }
        if (isLoading) {
          return (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-700">
              Cargando tenant...
            </div>
          );
        }
        if (!selected) {
          return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
              Selecciona un tenant en el menu lateral.
            </div>
          );
        }
        return (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DriversGroupModeCard key={selected.id} />
              <WhatsAppNumbersCard
                numbers={numbers}
                onEditNumber={(numberId) =>
                  router.push(`/owner/numbers/${numberId}`)
                }
                onDeleteNumber={(number) => {
                  setDeleteError(null);
                  setDeleting(number);
                }}
                onAddNumber={() => setIsAddingNumber(true)}
                onOpenInbox={(number) => {
                  const phone = (number.phoneNumber ?? "").replace(/\D/g, "");
                  router.push(
                    phone
                      ? `/conversation-mobile/${phone}`
                      : "/conversation-mobile",
                  );
                }}
              />
            </div>
            {isAddingNumber ? (
              <AddNumberModal
                onClose={() => setIsAddingNumber(false)}
                onCreated={(accountId) => {
                  setIsAddingNumber(false);
                  router.push(`/owner/numbers/${accountId}`);
                }}
              />
            ) : null}
            {deleting ? (
              <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
                <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                  <h2 className="text-lg font-semibold text-slate-950">
                    Eliminar numero
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Se deshabilitara{" "}
                    <span className="font-semibold text-slate-950">
                      {deleting.displayName}
                    </span>
                    . Dejara de aparecer en este tenant.
                  </p>
                  {deleteError ? (
                    <p className="mt-3 text-sm text-slate-700">{deleteError}</p>
                  ) : null}
                  <div className="mt-5 flex justify-end gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => setDeleting(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      disabled={isDeleting}
                      onClick={() => {
                        setIsDeleting(true);
                        setDeleteError(null);
                        void takuApi(`/whatsapp-accounts/${deleting.id}`, {
                          method: "DELETE",
                        })
                          .then(() => {
                            setDeleting(null);
                            refreshNumbers();
                          })
                          .catch((caught) => {
                            setDeleteError(
                              caught instanceof Error
                                ? caught.message
                                : "No se pudo eliminar el numero.",
                            );
                          })
                          .finally(() => setIsDeleting(false));
                      }}
                    >
                      {isDeleting ? "Eliminando..." : "Eliminar"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        );
      }}
    </OwnerShell>
  );
}
