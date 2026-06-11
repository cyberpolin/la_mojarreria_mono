import type { ServerResponse } from "node:http";

export type DebugLogLevel = "info" | "warn" | "error";

export type DebugLogEntry = {
  id: number;
  timestamp: string;
  level: DebugLogLevel;
  service: "bot-service";
  event: string;
  data?: Record<string, unknown>;
};

type DebugLogListener = (entry: DebugLogEntry) => void;

const MAX_ENTRIES = 300;
let nextId = 1;
const entries: DebugLogEntry[] = [];
const listeners = new Set<DebugLogListener>();

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 180 ? `${value.slice(0, 180)}...` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeValue(item),
      ]),
    );
  }

  return value;
}

export function recordDebugLog(params: {
  level?: DebugLogLevel;
  event: string;
  data?: Record<string, unknown>;
}): DebugLogEntry {
  const entry: DebugLogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    level: params.level ?? "info",
    service: "bot-service",
    event: params.event,
    data: params.data
      ? (sanitizeValue(params.data) as Record<string, unknown>)
      : undefined,
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.shift();
  }

  for (const listener of listeners) {
    listener(entry);
  }

  return entry;
}

export function listDebugLogs(): DebugLogEntry[] {
  return [...entries];
}

export function subscribeDebugLogs(listener: DebugLogListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function sendDebugLogsPage(res: ServerResponse, title: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; font: 14px system-ui, sans-serif; background: #101418; color: #e7edf3; }
    header { position: sticky; top: 0; background: #18212b; padding: 14px 18px; border-bottom: 1px solid #2d3a47; }
    h1 { margin: 0; font-size: 18px; }
    #status { color: #93a4b5; margin-top: 4px; }
    main { padding: 12px; }
    .entry { border: 1px solid #2d3a47; background: #151c24; border-radius: 6px; padding: 10px; margin-bottom: 8px; }
    .meta { display: flex; gap: 10px; flex-wrap: wrap; color: #93a4b5; margin-bottom: 6px; }
    .event { color: #f3f7fb; font-weight: 700; }
    .error .event { color: #ff9b9b; }
    .warn .event { color: #ffd37a; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0; color: #d2dbe5; }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <div id="status">connecting...</div>
  </header>
  <main id="logs"></main>
  <script>
    const statusEl = document.getElementById("status");
    const logsEl = document.getElementById("logs");
    const params = new URLSearchParams(location.search);
    const key = params.get("key") || "";
    const render = (entry) => {
      const node = document.createElement("section");
      node.className = "entry " + entry.level;
      node.innerHTML =
        '<div class="meta"><span>' + entry.timestamp + '</span><span>' + entry.service + '</span><span>' + entry.level + '</span></div>' +
        '<div class="event">' + entry.event + '</div>' +
        '<pre>' + JSON.stringify(entry.data || {}, null, 2) + '</pre>';
      logsEl.prepend(node);
    };
    fetch("/debug/logs/recent?key=" + encodeURIComponent(key))
      .then((res) => res.json())
      .then((payload) => (payload.logs || []).reverse().forEach(render))
      .catch(() => {});
    const source = new EventSource("/debug/logs/events?key=" + encodeURIComponent(key));
    source.onopen = () => { statusEl.textContent = "connected"; };
    source.onerror = () => { statusEl.textContent = "disconnected"; };
    source.onmessage = (event) => render(JSON.parse(event.data));
  </script>
</body>
</html>`);
}
