import { readJson, withFileLock, writeJson } from "../jsonStore.js";
import type { PageRecord, PublicPage } from "../types.js";

type PageFile = {
  pages: PageRecord[];
};

export class PageStoreError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PageStoreError";
    this.status = status;
  }
}

export function toPublicPage(page: PageRecord): PublicPage {
  return {
    pageId: page.pageId,
    label: page.label,
    accessTokenConfigured: page.accessToken.length > 0,
    messengerEnabled: page.messengerEnabled,
    messengerReplyText: page.messengerReplyText,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

export async function listPages(filePath: string): Promise<PageRecord[]> {
  const data = await readJson<PageFile>(filePath, { pages: [] });
  return data.pages;
}

export async function getPage(
  filePath: string,
  pageId: string,
): Promise<PageRecord | null> {
  const pages = await listPages(filePath);
  return pages.find((page) => page.pageId === pageId) ?? null;
}

export async function upsertPage(
  filePath: string,
  input: {
    pageId: string;
    label?: string;
    accessToken?: string;
    messengerEnabled?: boolean;
    messengerReplyText?: string | null;
  },
): Promise<PublicPage> {
  return withFileLock(filePath, async () => {
    const data = await readJson<PageFile>(filePath, { pages: [] });
    const index = data.pages.findIndex((page) => page.pageId === input.pageId);
    const existing = index >= 0 ? data.pages[index] : null;
    if (!existing && !input.accessToken) {
      throw new PageStoreError("accessToken is required");
    }

    const now = new Date().toISOString();
    const next: PageRecord = {
      pageId: input.pageId,
      label: input.label ?? existing?.label ?? input.pageId,
      accessToken: input.accessToken ?? existing?.accessToken ?? "",
      messengerEnabled:
        input.messengerEnabled ?? existing?.messengerEnabled ?? false,
      messengerReplyText:
        input.messengerReplyText !== undefined
          ? input.messengerReplyText
          : (existing?.messengerReplyText ?? null),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (!next.accessToken) {
      throw new PageStoreError("accessToken is required");
    }

    const pages = data.pages.slice();
    if (index >= 0) {
      pages[index] = next;
    } else {
      pages.push(next);
    }

    await writeJson(filePath, { pages });
    return toPublicPage(next);
  });
}

export async function deletePage(
  filePath: string,
  pageId: string,
): Promise<void> {
  await withFileLock(filePath, async () => {
    const data = await readJson<PageFile>(filePath, { pages: [] });
    if (!data.pages.some((page) => page.pageId === pageId)) {
      throw new PageStoreError("Page not found", 404);
    }

    await writeJson(filePath, {
      pages: data.pages.filter((page) => page.pageId !== pageId),
    });
  });
}
