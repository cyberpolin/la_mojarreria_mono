"use client";

import { AutoRepliesPanel } from "@/components/inbox/AutoRepliesPanel";
import { NumberBreadcrumb } from "../NumberBreadcrumb";
import { OwnerShell } from "../OwnerShell";

export default function OwnerAutoRepliesPage() {
  return (
    <OwnerShell headerLabel="Informacion general">
      {() => (
        <div className="grid gap-6">
          <NumberBreadcrumb current="Respuestas automaticas" />
          <AutoRepliesPanel />
        </div>
      )}
    </OwnerShell>
  );
}
