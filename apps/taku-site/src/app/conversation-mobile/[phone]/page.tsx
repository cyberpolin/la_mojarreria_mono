"use client";

import { useParams } from "next/navigation";
import { MobileInboxPhoneSegment } from "@/components/inbox/MobileInboxGate";

export default function ConversationMobilePage() {
  const params = useParams<{ phone: string }>();
  const phone = typeof params.phone === "string" ? params.phone : "";
  if (!phone) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-100 px-4 text-sm text-slate-600">
        Falta el numero en la URL.
      </main>
    );
  }
  return <MobileInboxPhoneSegment phone={phone} />;
}
