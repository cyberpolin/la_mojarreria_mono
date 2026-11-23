import type { PublicationRule } from "./types.js";

export function samePost(rulePostId: string, eventPostId: string): boolean {
  if (rulePostId === eventPostId) {
    return true;
  }

  const ruleTail = rulePostId.split("_").at(-1) ?? "";
  const eventTail = eventPostId.split("_").at(-1) ?? "";
  return ruleTail.length > 0 && ruleTail === eventTail;
}

export function isTopLevelComment(
  postId: string,
  parentId: string | null,
): boolean {
  return parentId === null || parentId === postId;
}

export function selectPublicationRule(params: {
  rules: readonly PublicationRule[];
  pageId: string;
  postId: string;
  parentId: string | null;
  message: string;
}): PublicationRule | null {
  const haystack = params.message.toLocaleLowerCase();
  const matches = params.rules.filter((rule) => {
    if (!rule.enabled || rule.pageId !== params.pageId) {
      return false;
    }

    if (
      rule.topLevelOnly &&
      !isTopLevelComment(params.postId, params.parentId)
    ) {
      return false;
    }

    if (
      !rule.matchAllPosts &&
      !rule.postIds.some((postId) => samePost(postId, params.postId))
    ) {
      return false;
    }

    if (rule.keywords.length === 0) {
      return true;
    }

    return rule.keywords.some((keyword) =>
      haystack.includes(keyword.toLocaleLowerCase()),
    );
  });

  matches.sort((left, right) => {
    const specificity =
      Number(!right.matchAllPosts) - Number(!left.matchAllPosts);
    if (specificity !== 0) {
      return specificity;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });

  return matches[0] ?? null;
}
