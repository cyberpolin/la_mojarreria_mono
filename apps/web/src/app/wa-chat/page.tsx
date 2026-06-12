import { WaChatClient } from "@/components/wa-chat/wa-chat-client";

export default function WaChatPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          WHATSAPP
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">WA Chat</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Conversations from the connected wa-service phone.
        </p>
      </header>

      <WaChatClient />
    </main>
  );
}
