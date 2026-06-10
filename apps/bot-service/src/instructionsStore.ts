import { readJson, writeJson } from "./jsonStore.js";

export type InstructionsRecord = {
  instructions: string;
  updatedAt: string;
};

export async function getInstructions(
  filePath: string,
): Promise<InstructionsRecord | null> {
  const record = await readJson<InstructionsRecord | null>(filePath, null);

  if (!record?.instructions?.trim()) {
    return null;
  }

  return record;
}

export async function saveInstructions(params: {
  filePath: string;
  instructions: string;
}): Promise<InstructionsRecord> {
  const record = {
    instructions: params.instructions.trim(),
    updatedAt: new Date().toISOString(),
  };

  await writeJson(params.filePath, record);
  return record;
}
