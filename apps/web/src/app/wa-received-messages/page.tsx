import { WaReceivedMessagesClient } from "@/components/wa-received-messages/wa-received-messages-client";

export default function WaReceivedMessagesPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          WHATSAPP DEBUG
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">
          Received Messages
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Only special receive logs from wa-service.
        </p>
      </header>

      <WaReceivedMessagesClient />
    </main>
  );
}
