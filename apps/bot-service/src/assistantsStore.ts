import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "./jsonStore.js";

export type AssistantRecord = {
  id: string;
  clientId?: string | null;
  name: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
};

type AssistantsStore = {
  assistants: AssistantRecord[];
};

async function readStore(filePath: string): Promise<AssistantsStore> {
  const store = await readJson<AssistantsStore>(filePath, { assistants: [] });
  return {
    assistants: Array.isArray(store.assistants) ? store.assistants : [],
  };
}

export async function listAssistants(
  filePath: string,
  clientId: string,
): Promise<AssistantRecord[]> {
  return (await readStore(filePath)).assistants.filter(
    (assistant) => assistant.clientId === clientId,
  );
}

export async function getAssistant(params: {
  filePath: string;
  assistantId: string;
  clientId: string;
}): Promise<AssistantRecord | null> {
  const store = await readStore(params.filePath);
  return (
    store.assistants.find(
      (assistant) =>
        assistant.id === params.assistantId &&
        assistant.clientId === params.clientId,
    ) ?? null
  );
}

export async function createAssistant(params: {
  filePath: string;
  clientId: string;
  name: string;
  instructions: string;
}): Promise<AssistantRecord> {
  const store = await readStore(params.filePath);
  const now = new Date().toISOString();
  const assistant = {
    id: `asst_${randomUUID()}`,
    clientId: params.clientId,
    name: params.name.trim(),
    instructions: params.instructions.trim(),
    createdAt: now,
    updatedAt: now,
  };

  store.assistants.unshift(assistant);
  await writeJson(params.filePath, store);
  return assistant;
}

export async function updateAssistant(params: {
  filePath: string;
  assistantId: string;
  clientId: string;
  name: string;
  instructions: string;
}): Promise<AssistantRecord | null> {
  const store = await readStore(params.filePath);
  const assistant = store.assistants.find(
    (item) =>
      item.id === params.assistantId && item.clientId === params.clientId,
  );
  if (!assistant) {
    return null;
  }

  assistant.name = params.name.trim();
  assistant.instructions = params.instructions.trim();
  assistant.updatedAt = new Date().toISOString();
  await writeJson(params.filePath, store);
  return assistant;
}
