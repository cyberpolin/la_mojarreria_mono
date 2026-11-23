import { readJson, withFileLock, writeJson } from "../jsonStore.js";
import type { InboundOutcome } from "../types.js";

export type EventLogEntry = {
  eventId: string;
  type: string;
  pageId: string;
  receivedAt: string;
  outcome: InboundOutcome;
  detail: string | null;
};

type EventLogFile = {
  events: EventLogEntry[];
};

const MAX_EVENT_LOGS = 200;

export async function listEventLogs(
  filePath: string,
): Promise<EventLogEntry[]> {
  const data = await readJson<EventLogFile>(filePath, { events: [] });
  return data.events;
}

export async function appendEventLog(
  filePath: string,
  entry: EventLogEntry,
): Promise<void> {
  await withFileLock(filePath, async () => {
    const data = await readJson<EventLogFile>(filePath, { events: [] });
    await writeJson(filePath, {
      events: [...data.events, entry].slice(-MAX_EVENT_LOGS),
    });
  });
}
