import Link from "next/link";
import { getErrorLogs } from "@/lib/error-logs";

export default async function SyncLogsPage() {
  const result = await getErrorLogs({
    page: 1,
    pageSize: 20,
    type: "SYNC_DAILY_CLOSE",
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA OPERATIONS
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">Sync Logs</h1>
        </div>
        <Link
          href="/admin/error-logs"
          className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700 inline-flex items-center"
        >
          Advanced filters
        </Link>
      </header>

      {result.error ? (
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
          {result.error}
        </section>
      ) : (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Time</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Device</th>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {result.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-2 py-2 text-slate-300">
                      {entry.createdAt}
                    </td>
                    <td className="px-2 py-2 text-slate-100">{entry.status}</td>
                    <td className="px-2 py-2 text-slate-200">
                      {entry.deviceId}
                    </td>
                    <td className="px-2 py-2 text-slate-300">{entry.date}</td>
                    <td className="px-2 py-2 text-slate-300">
                      {entry.errorMessage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
