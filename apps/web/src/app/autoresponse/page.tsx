import { AutoresponseClient } from "@/components/autoresponse/autoresponse-client";

export default function AutoresponsePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MOJARRERIA OPERATIONS
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">Auto-response</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Manage bot-service instructions, wa-service auto-response state, and
          test phones.
        </p>
      </header>

      <AutoresponseClient />
    </main>
  );
}
