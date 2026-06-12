"use client";

import { useEffect, useState } from "react";

type ReceivedMessageLogEntry = {
  id: number;
  timestamp: string;
  line: string;
  phone: string | null;
  source: "baileys_raw" | "app_message";
  data?: Record<string, unknown>;
};

function sortLogs(logs: ReceivedMessageLogEntry[]) {
  return [...logs].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function WaReceivedMessagesClient() {
  const [logs, setLogs] = useState<ReceivedMessageLogEntry[]>([]);
  const [live, setLive] = useState(true);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wa-received-messages/recent", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload?.ok) {
          throw new Error(payload?.error ?? "Failed to load logs");
        }
        setLogs(sortLogs(payload.logs ?? []));
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load logs",
        );
      });
  }, []);

  useEffect(() => {
    if (!live) {
      setStatus("paused");
      return;
    }

    const source = new EventSource("/api/wa-received-messages/events");
    source.onopen = () => setStatus("connected");
    source.onerror = () => setStatus("disconnected");
    source.onmessage = (event) => {
      const entry = JSON.parse(event.data) as ReceivedMessageLogEntry;
      setLogs((current) =>
        sortLogs([
          entry,
          ...current.filter(
            (item) =>
              item.id !== entry.id || item.timestamp !== entry.timestamp,
          ),
        ]).slice(0, 300),
      );
    };

    return () => source.close();
  }, [live]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
        <div className="text-sm text-slate-300">
          Stream: <span className="text-slate-100">{status}</span>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={live}
            onChange={(event) => setLive(event.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          Live
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-medium text-slate-100">
            {logs.length} received-message events
          </p>
        </div>
        <div className="max-h-[72vh] overflow-y-auto p-3">
          {logs.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
              No received-message events yet.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <article
                  key={`${log.id}-${log.timestamp}`}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-3"
                >
                  <div className="text-sm font-semibold text-slate-100">
                    {log.line}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>{formatTime(log.timestamp)}</span>
                    <span>{log.source}</span>
                    <span>{log.phone ?? "UNKNOWN"}</span>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-300">
                    {JSON.stringify(log.data ?? {}, null, 2)}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
