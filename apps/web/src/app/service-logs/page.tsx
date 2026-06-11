import { ServiceLogsClient } from "@/components/service-logs/service-logs-client";

export default function ServiceLogsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MOJARRERIA OPERATIONS
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">Service Logs</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Live debug events from wa-service and bot-service.
        </p>
      </header>

      <ServiceLogsClient />
    </main>
  );
}
