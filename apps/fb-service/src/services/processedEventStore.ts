import { readJson, withFileLock, writeJson } from "../jsonStore.js";

type ProcessedFile = {
  events: Array<{
    eventId: string;
    processedAt: string;
  }>;
};

const MAX_PROCESSED_EVENTS = 2000;

export async function claimEvent(
  filePath: string,
  eventId: string,
): Promise<boolean> {
  return withFileLock(filePath, async () => {
    const data = await readJson<ProcessedFile>(filePath, { events: [] });
    if (data.events.some((event) => event.eventId === eventId)) {
      return false;
    }

    await writeJson(filePath, {
      events: [
        ...data.events,
        { eventId, processedAt: new Date().toISOString() },
      ].slice(-MAX_PROCESSED_EVENTS),
    });
    return true;
  });
}

export async function releaseEvent(
  filePath: string,
  eventId: string,
): Promise<void> {
  await withFileLock(filePath, async () => {
    const data = await readJson<ProcessedFile>(filePath, { events: [] });
    await writeJson(filePath, {
      events: data.events.filter((event) => event.eventId !== eventId),
    });
  });
}
