"use client";

import { useParams } from "next/navigation";
import { MobileInboxThread } from "@/components/inbox/MobileInboxGate";

export default function ConversationMobileThreadPage() {
  const params = useParams<{ phone: string; contactPhone: string }>();
  const accountSlug = typeof params.phone === "string" ? params.phone : "";
  const contactPhone =
    typeof params.contactPhone === "string" ? params.contactPhone : "";
  if (!accountSlug || !contactPhone) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-100 px-4 text-sm text-slate-600">
        Falta el numero en la URL.
      </main>
    );
  }
  return (
    <MobileInboxThread accountSlug={accountSlug} contactPhone={contactPhone} />
  );
}
