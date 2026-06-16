import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type ConnectionRegistryRecord = {
  connectionId: string;
  businessId: string | null;
  label: string | null;
  autoStart: boolean;
  createdAt: string;
  updatedAt: string;
};

type ConnectionRegistryData = {
  connections: ConnectionRegistryRecord[];
};

let writeQueue = Promise.resolve();

function emptyData(): ConnectionRegistryData {
  return { connections: [] };
}

async function readData(filePath: string): Promise<ConnectionRegistryData> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as Partial<ConnectionRegistryData>;

    if (!Array.isArray(parsed.connections)) {
      return emptyData();
    }

    return { connections: parsed.connections };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyData();
    }

    throw error;
  }
}

async function writeData(
  filePath: string,
  data: ConnectionRegistryData,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );

  return next;
}

export async function listConnectionRegistryRecords(
  filePath: string,
): Promise<ConnectionRegistryRecord[]> {
  const data = await readData(filePath);
  return data.connections;
}

export async function upsertConnectionRegistryRecord(params: {
  filePath: string;
  connectionId: string;
  businessId: string | null;
  label: string | null;
  autoStart?: boolean;
}): Promise<ConnectionRegistryRecord> {
  return enqueueWrite(async () => {
    const now = new Date().toISOString();
    const data = await readData(params.filePath);
    const existing = data.connections.find(
      (record) => record.connectionId === params.connectionId,
    );
    const record: ConnectionRegistryRecord = {
      connectionId: params.connectionId,
      businessId: params.businessId,
      label: params.label,
      autoStart: params.autoStart ?? existing?.autoStart ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      Object.assign(existing, record);
    } else {
      data.connections.push(record);
    }

    await writeData(params.filePath, data);
    return record;
  });
}
