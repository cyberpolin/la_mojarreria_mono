import { readJson, writeJson } from "./jsonStore.js";

type ProcessedMessageRecord = {
  messageId: string;
  processedAt: string;
};

type ProcessedMessagesStore = {
  messages: ProcessedMessageRecord[];
};

const MAX_PROCESSED_MESSAGES = 1000;

export async function hasProcessedMessage(params: {
  filePath: string;
  messageId: string;
}): Promise<boolean> {
  const data = await readJson<ProcessedMessagesStore>(params.filePath, {
    messages: [],
  });

  return data.messages.some(
    (message) => message.messageId === params.messageId,
  );
}

export async function recordProcessedMessage(params: {
  filePath: string;
  messageId: string;
}): Promise<void> {
  const data = await readJson<ProcessedMessagesStore>(params.filePath, {
    messages: [],
  });

  const messages = [
    ...data.messages.filter(
      (message) => message.messageId !== params.messageId,
    ),
    { messageId: params.messageId, processedAt: new Date().toISOString() },
  ].slice(-MAX_PROCESSED_MESSAGES);

  await writeJson(params.filePath, { messages });
}
