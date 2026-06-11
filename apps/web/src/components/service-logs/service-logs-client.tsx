"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ServiceDebugLogEntry,
  ServiceDebugLogName,
} from "@/lib/service-debug-logs";

const SERVICES: Array<{ id: ServiceDebugLogName; label: string }> = [
  { id: "wa-service", label: "WA Service" },
  { id: "bot-service", label: "Bot Service" },
];

type StreamState = "connecting" | "connected" | "disconnected";

type RecentLogsResponse = {
  ok?: boolean;
  logs?: ServiceDebugLogEntry[];
  error?: string;
  upstream?: string;
};

function sortLogs(logs: ServiceDebugLogEntry[]) {
  return [...logs].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp),
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function levelClass(level: ServiceDebugLogEntry["level"]) {
  if (level === "error") return "border-red-500/40 bg-red-950/30 text-red-100";
  if (level === "warn")
    return "border-amber-500/40 bg-amber-950/30 text-amber-100";
  return "border-slate-700 bg-slate-900 text-slate-100";
}

export function ServiceLogsClient() {
  const [selectedService, setSelectedService] =
    useState<ServiceDebugLogName>("wa-service");
  const [logs, setLogs] = useState<ServiceDebugLogEntry[]>([]);
  const [streamState, setStreamState] = useState<
    Record<ServiceDebugLogName, StreamState>
  >({
    "wa-service": "connecting",
    "bot-service": "connecting",
  });
  const [serviceErrors, setServiceErrors] = useState<
    Partial<Record<ServiceDebugLogName, string>>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadRecent(service: ServiceDebugLogName) {
      const response = await fetch(`/api/service-logs/${service}/recent`, {
        cache: "no-store",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as RecentLogsResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          [
            payload?.error ??
              `${service} recent logs failed (${response.status})`,
            payload?.upstream ? `upstream: ${payload.upstream}` : null,
          ]
            .filter(Boolean)
            .join(" - "),
        );
      }

      return payload.logs ?? [];
    }

    Promise.allSettled(SERVICES.map((service) => loadRecent(service.id))).then(
      (results) => {
        if (cancelled) return;
        const loadedLogs: ServiceDebugLogEntry[] = [];
        const errors: Partial<Record<ServiceDebugLogName, string>> = {};

        results.forEach((result, index) => {
          const service = SERVICES[index];
          if (result.status === "fulfilled") {
            loadedLogs.push(...result.value);
            return;
          }

          errors[service.id] =
            result.reason instanceof Error
              ? result.reason.message
              : "Failed to load service logs";
        });

        setLogs(sortLogs(loadedLogs));
        setServiceErrors(errors);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sources = SERVICES.map((service) => {
      const source = new EventSource(`/api/service-logs/${service.id}/events`);

      source.onopen = () => {
        setStreamState((current) => ({
          ...current,
          [service.id]: "connected",
        }));
        setServiceErrors((current) => {
          const next = { ...current };
          delete next[service.id];
          return next;
        });
      };

      source.onerror = () => {
        setStreamState((current) => ({
          ...current,
          [service.id]: "disconnected",
        }));
        setServiceErrors((current) => ({
          ...current,
          [service.id]: `${service.label} live stream disconnected`,
        }));
      };

      source.onmessage = (event) => {
        const entry = JSON.parse(event.data) as ServiceDebugLogEntry;
        setLogs((current) =>
          sortLogs([
            entry,
            ...current.filter(
              (item) =>
                item.service !== entry.service ||
                item.id !== entry.id ||
                item.timestamp !== entry.timestamp,
            ),
          ]).slice(0, 300),
        );
      };

      return source;
    });

    return () => {
      for (const source of sources) {
        source.close();
      }
    };
  }, []);

  const visibleLogs = useMemo(
    () => logs.filter((log) => log.service === selectedService),
    [logs, selectedService],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1">
          {SERVICES.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => setSelectedService(service.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                selectedService === service.id
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {service.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {SERVICES.map((service) => (
            <span
              key={service.id}
              className="rounded-full border border-slate-700 px-3 py-1 text-slate-300"
            >
              {service.label}: {streamState[service.id]}
            </span>
          ))}
        </div>
      </div>

      {serviceErrors[selectedService] ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100">
          {serviceErrors[selectedService]}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-medium text-slate-100">
            {SERVICES.find((service) => service.id === selectedService)?.label}
          </p>
          <p className="text-xs text-slate-400">
            {visibleLogs.length} events retained in this browser session
          </p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-3">
          {visibleLogs.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
              No events yet.
            </div>
          ) : (
            <div className="space-y-2">
              {visibleLogs.map((log) => (
                <article
                  key={`${log.service}-${log.id}-${log.timestamp}`}
                  className={`rounded-lg border p-3 ${levelClass(log.level)}`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{formatTime(log.timestamp)}</span>
                    <span>{log.service}</span>
                    <span>{log.level}</span>
                  </div>
                  <h2 className="text-sm font-semibold">{log.event}</h2>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">
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
