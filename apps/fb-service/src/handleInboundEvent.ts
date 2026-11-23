import type {
  InboundResult,
  PageRecord,
  ParsedFacebookEvent,
  PublicationRule,
} from "./types.js";
import { selectPublicationRule } from "./replyPolicy.js";

export type InboundDeps = {
  replyMode: "local" | "backend";
  pages: readonly PageRecord[];
  rules: readonly PublicationRule[];
  claim: (eventId: string) => Promise<boolean>;
  release: (eventId: string) => Promise<void>;
  sendMessenger: (input: {
    page: PageRecord;
    recipientId: string;
    text: string;
  }) => Promise<void>;
  sendCommentReply: (input: {
    page: PageRecord;
    commentId: string;
    text: string;
  }) => Promise<void>;
  forwardToBackend: (event: ParsedFacebookEvent) => Promise<void>;
};

export async function handleInboundEvent(
  event: ParsedFacebookEvent,
  deps: InboundDeps,
): Promise<InboundResult> {
  const claimed = await deps.claim(event.eventId);
  if (!claimed) {
    return { outcome: "duplicate", detail: null, retryable: false };
  }

  try {
    if (
      event.kind === "publication.comment" &&
      event.fromId !== null &&
      event.fromId === event.pageId
    ) {
      return { outcome: "ignored", detail: "page_authored", retryable: false };
    }

    if (deps.replyMode === "backend") {
      await deps.forwardToBackend(event);
      return { outcome: "forwarded", detail: null, retryable: false };
    }

    const page =
      deps.pages.find((item) => item.pageId === event.pageId) ?? null;
    if (!page) {
      return {
        outcome: "ignored",
        detail: "page_not_configured",
        retryable: false,
      };
    }

    if (event.kind === "messenger.message") {
      if (!page.messengerEnabled) {
        return {
          outcome: "ignored",
          detail: "messenger_disabled",
          retryable: false,
        };
      }

      if (!page.messengerReplyText) {
        return {
          outcome: "no_rule",
          detail: "messenger_reply_not_configured",
          retryable: false,
        };
      }

      await deps.sendMessenger({
        page,
        recipientId: event.senderId,
        text: page.messengerReplyText,
      });
      return { outcome: "replied", detail: null, retryable: false };
    }

    const rule = selectPublicationRule({
      rules: deps.rules,
      pageId: event.pageId,
      postId: event.postId,
      parentId: event.parentId,
      message: event.message,
    });
    if (!rule) {
      return { outcome: "no_rule", detail: null, retryable: false };
    }

    await deps.sendCommentReply({
      page,
      commentId: event.commentId,
      text: rule.replyText,
    });
    return { outcome: "replied", detail: rule.id, retryable: false };
  } catch (error) {
    await deps.release(event.eventId);
    return {
      outcome: "error",
      detail: error instanceof Error ? error.message : "inbound_failed",
      retryable: true,
    };
  }
}
