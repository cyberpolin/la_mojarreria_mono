import Link from "next/link";
import { getErrorLogs, normalizeFilters } from "@/lib/error-logs";
import { SyncLogStatus, SyncLogType } from "@/types/error-log";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const isStatus = (value?: string): value is SyncLogStatus =>
  value === "FAILED" || value === "SUCCESS";
const isType = (value?: string): value is SyncLogType =>
  value === "SYNC_DAILY_CLOSE" || value === "SYNC_OTHER";

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const toPage = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
};

const toPageSize = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 20;
};

const buildQuery = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default async function ErrorLogsPage({ searchParams }: PageProps) {
  const statusParam = firstParam(searchParams?.status);
  const typeParam = firstParam(searchParams?.type);
  const deviceIdParam = firstParam(searchParams?.deviceId);
  const dateParam = firstParam(searchParams?.date);
  const pageParam = firstParam(searchParams?.page);
  const pageSizeParam = firstParam(searchParams?.pageSize);

  const filters = normalizeFilters({
    page: toPage(pageParam),
    pageSize: toPageSize(pageSizeParam),
    status: isStatus(statusParam) ? statusParam : undefined,
    type: isType(typeParam) ? typeParam : undefined,
    deviceId: deviceIdParam,
    date: dateParam,
  });

  const result = await getErrorLogs(filters);
  const totalPages = Math.max(1, Math.ceil(result.total / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const baseParams = {
    status: filters.status,
    type: filters.type,
    deviceId: filters.deviceId,
    date: filters.date,
    pageSize: String(filters.pageSize),
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-10 md:px-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MOJARRERIA ADMIN
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">Error Logs</h1>
        <p className="text-sm text-slate-300">
          Operational visibility for sync failures and related backend errors.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 md:p-6">
        <form className="grid gap-4 md:grid-cols-6" method="GET">
          <label className="flex flex-col gap-2 text-xs text-slate-300 md:col-span-1">
            Status
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="">All</option>
              <option value="FAILED">Failed</option>
              <option value="SUCCESS">Success</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs text-slate-300 md:col-span-1">
            Type
            <select
              name="type"
              defaultValue={filters.type ?? ""}
              className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="">All</option>
              <option value="SYNC_DAILY_CLOSE">SYNC_DAILY_CLOSE</option>
              <option value="SYNC_OTHER">SYNC_OTHER</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs text-slate-300 md:col-span-2">
            Device ID
            <input
              name="deviceId"
              defaultValue={filters.deviceId ?? ""}
              placeholder="kiosk-001"
              className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-xs text-slate-300 md:col-span-1">
            Date
            <input
              name="date"
              type="date"
              defaultValue={filters.date ?? ""}
              className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-xs text-slate-300 md:col-span-1">
            Page Size
            <select
              name="pageSize"
              defaultValue={String(filters.pageSize)}
              className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>

          <div className="md:col-span-6 flex flex-wrap gap-3">
            <button
              type="submit"
              className="h-11 rounded-lg border border-slate-700 bg-slate-100 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Apply Filters
            </button>
            <Link
              href="/admin/error-logs"
              className="h-11 rounded-lg border border-slate-700 bg-slate-800 px-4 text-sm font-medium text-slate-100 hover:bg-slate-700 inline-flex items-center"
            >
              Reset
            </Link>
            <Link
              href={
                buildQuery({ ...baseParams, page: String(currentPage) }) ||
                "/admin/error-logs"
              }
              className="h-11 rounded-lg border border-slate-700 bg-slate-800 px-4 text-sm font-medium text-slate-100 hover:bg-slate-700 inline-flex items-center"
            >
              Refresh
            </Link>
          </div>
        </form>
      </section>

      {result.error ? (
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          <p className="font-medium text-slate-100">Log source unavailable</p>
          <p className="mt-1 text-slate-300">{result.error}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
          <p>
            Source: <span className="text-slate-100">{result.source}</span>
          </p>
          <p>
            Showing{" "}
            <span className="text-slate-100">{result.entries.length}</span> of{" "}
            <span className="text-slate-100">{result.total}</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3">Time</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Device</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Message</th>
                <th className="px-3 py-3">Retry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {result.entries.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-slate-400" colSpan={7}>
                    No logs found for current filters.
                  </td>
                </tr>
              ) : (
                result.entries.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="px-3 py-3 text-slate-300">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          entry.status === "FAILED"
                            ? "rounded-full border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                            : "rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300"
                        }
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-300">{entry.type}</td>
                    <td className="px-3 py-3 text-slate-200">
                      {entry.deviceId}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {entry.date ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-200">
                      <p className="max-w-xl whitespace-pre-wrap break-words">
                        {entry.errorMessage ?? "-"}
                      </p>
                      {entry.payloadSnapshot ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                            View payload snapshot
                          </summary>
                          <pre className="mt-2 max-h-48 overflow-auto rounded border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300">
                            {JSON.stringify(entry.payloadSnapshot, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {entry.retryCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between text-sm">
          <Link
            className={
              currentPage <= 1
                ? "pointer-events-none rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-500"
                : "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 hover:bg-slate-700"
            }
            href={
              buildQuery({
                ...baseParams,
                page: String(Math.max(1, currentPage - 1)),
              }) || "/admin/error-logs"
            }
          >
            Previous
          </Link>
          <p className="text-slate-300">
            Page {currentPage} of {totalPages}
          </p>
          <Link
            className={
              currentPage >= totalPages
                ? "pointer-events-none rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-500"
                : "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 hover:bg-slate-700"
            }
            href={
              buildQuery({
                ...baseParams,
                page: String(Math.min(totalPages, currentPage + 1)),
              }) || "/admin/error-logs"
            }
          >
            Next
          </Link>
        </div>
      </section>
    </main>
  );
}
