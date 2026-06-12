export type ReceivedMessageLogEntry = {
  id: number;
  timestamp: string;
  line: string;
  level: "baileys_raw" | "app_message";
  phone: string | null;
  source: "baileys_raw" | "app_message";
  data?: Record<string, unknown>;
};

type ReceivedMessageLogListener = (entry: ReceivedMessageLogEntry) => void;

const MAX_ENTRIES = 300;
let nextId = 1;
const entries: ReceivedMessageLogEntry[] = [];
const listeners = new Set<ReceivedMessageLogListener>();

function normalizePhoneFromJid(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }

  return value.split("@")[0]?.split(":")[0] ?? null;
}

export function getPhoneFromBaileysAttrs(attrs: unknown): string | null {
  if (!attrs || typeof attrs !== "object") {
    return null;
  }

  const values = attrs as Record<string, unknown>;
  return (
    normalizePhoneFromJid(values.peer_recipient_pn) ??
    normalizePhoneFromJid(values.participant_pn) ??
    normalizePhoneFromJid(values.sender_pn) ??
    normalizePhoneFromJid(values.from) ??
    normalizePhoneFromJid(values.participant) ??
    normalizePhoneFromJid(values.recipient)
  );
}

export function recordReceivedMessageLog(params: {
  phone: string | null;
  source: ReceivedMessageLogEntry["source"];
  data?: Record<string, unknown>;
}): ReceivedMessageLogEntry {
  const phone = params.phone;
  const entry: ReceivedMessageLogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    line: `[SPECIAL]: RECEIVED MESSAGE FROM ${phone ?? "UNKNOWN"} LEVEL ${params.source}`,
    level: params.source,
    phone,
    source: params.source,
    data: params.data,
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

export function listReceivedMessageLogs(): ReceivedMessageLogEntry[] {
  return [...entries];
}

export function subscribeReceivedMessageLogs(
  listener: ReceivedMessageLogListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function renderReceivedMessageLogsPage(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>wa-service received messages</title>
  <style>
    body { margin: 0; font: 14px system-ui, sans-serif; background: #101418; color: #e7edf3; }
    header { position: sticky; top: 0; background: #18212b; padding: 14px 18px; border-bottom: 1px solid #2d3a47; }
    h1 { margin: 0; font-size: 18px; }
    #status { color: #93a4b5; margin-top: 4px; }
    main { padding: 12px; }
    .entry { border: 1px solid #2d3a47; background: #151c24; border-radius: 6px; padding: 10px; margin-bottom: 8px; }
    .line { color: #f3f7fb; font-weight: 800; }
    .meta { color: #93a4b5; margin-top: 4px; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 8px 0 0; color: #d2dbe5; }
  </style>
</head>
<body>
  <header>
    <h1>wa-service received messages</h1>
    <div id="status">connecting...</div>
  </header>
  <main id="logs"></main>
  <script>
    const statusEl = document.getElementById("status");
    const logsEl = document.getElementById("logs");
    const render = (entry) => {
      const node = document.createElement("section");
      node.className = "entry";
      node.innerHTML =
        '<div class="line">' + entry.line + '</div>' +
        '<div class="meta">' + entry.timestamp + ' · level: ' + entry.level + ' · source: ' + entry.source + '</div>' +
        '<pre>' + JSON.stringify(entry.data || {}, null, 2) + '</pre>';
      logsEl.prepend(node);
    };
    fetch("/debug/received-messages/recent")
      .then((res) => res.json())
      .then((payload) => (payload.logs || []).reverse().forEach(render))
      .catch(() => {});
    const source = new EventSource("/debug/received-messages/events");
    source.onopen = () => { statusEl.textContent = "connected"; };
    source.onerror = () => { statusEl.textContent = "disconnected"; };
    source.onmessage = (event) => render(JSON.parse(event.data));
  </script>
</body>
</html>`;
}
