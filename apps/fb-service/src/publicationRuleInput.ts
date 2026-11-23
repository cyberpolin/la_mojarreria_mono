import { readString, readStringList } from "./text.js";

const MAX_POST_IDS = 50;
const MAX_KEYWORDS = 20;
const MAX_REPLY_LENGTH = 2000;

export type PublicationRuleInput = {
  pageId: string;
  enabled: boolean;
  matchAllPosts: boolean;
  postIds: string[];
  keywords: string[];
  replyText: string;
  topLevelOnly: boolean;
};

export function parsePublicationRuleInput(
  value: unknown,
  defaults?: Partial<PublicationRuleInput>,
): PublicationRuleInput {
  const body =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const pageId = readString(body.pageId) ?? defaults?.pageId ?? "";
  const replyText = readString(body.replyText) ?? defaults?.replyText ?? "";
  const matchAllPosts =
    typeof body.matchAllPosts === "boolean"
      ? body.matchAllPosts
      : (defaults?.matchAllPosts ?? false);
  const enabled =
    typeof body.enabled === "boolean"
      ? body.enabled
      : (defaults?.enabled ?? true);
  const topLevelOnly =
    typeof body.topLevelOnly === "boolean"
      ? body.topLevelOnly
      : (defaults?.topLevelOnly ?? true);
  const postIds =
    body.postIds === undefined
      ? (defaults?.postIds ?? [])
      : readStringList(body.postIds, MAX_POST_IDS);
  const keywords =
    body.keywords === undefined
      ? (defaults?.keywords ?? [])
      : readStringList(body.keywords, MAX_KEYWORDS).map((keyword) =>
          keyword.toLocaleLowerCase(),
        );

  if (!/^[0-9]+$/.test(pageId)) {
    throw new Error("pageId must be a numeric Facebook page id");
  }

  if (!replyText || replyText.length > MAX_REPLY_LENGTH) {
    throw new Error("replyText must be between 1 and 2000 characters");
  }

  if (!matchAllPosts && postIds.length === 0) {
    throw new Error(
      "Select at least one publication, or set matchAllPosts to true",
    );
  }

  return {
    pageId,
    enabled,
    matchAllPosts,
    postIds,
    keywords,
    replyText,
    topLevelOnly,
  };
}

export function parseReplyText(value: unknown): string {
  const text = readString(value);
  if (!text || text.length > MAX_REPLY_LENGTH) {
    throw new Error("text must be between 1 and 2000 characters");
  }

  return text;
}
