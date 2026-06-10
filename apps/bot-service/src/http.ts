import type { IncomingMessage, ServerResponse } from "node:http";

export type JsonResponse = {
  status: number;
  body: unknown;
};

export async function readRequestJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as unknown;
}

export function sendJson(res: ServerResponse, response: JsonResponse): void {
  const body = JSON.stringify(response.body);
  res.writeHead(response.status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}
