export type ReplyMode = "local" | "backend";

export type PageRecord = {
  pageId: string;
  label: string;
  accessToken: string;
  messengerEnabled: boolean;
  messengerReplyText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicPage = {
  pageId: string;
  label: string;
  accessTokenConfigured: boolean;
  messengerEnabled: boolean;
  messengerReplyText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicationRule = {
  id: string;
  pageId: string;
  enabled: boolean;
  matchAllPosts: boolean;
  postIds: string[];
  keywords: string[];
  replyText: string;
  topLevelOnly: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ParsedMessengerEvent = {
  kind: "messenger.message";
  pageId: string;
  eventId: string;
  senderId: string;
  messageId: string;
  text: string;
  timestamp: string;
};

export type ParsedCommentEvent = {
  kind: "publication.comment";
  pageId: string;
  eventId: string;
  commentId: string;
  postId: string;
  parentId: string | null;
  fromId: string | null;
  fromName: string | null;
  message: string;
  createdTime: string | null;
};

export type ParsedFacebookEvent = ParsedMessengerEvent | ParsedCommentEvent;

export type InboundOutcome =
  | "duplicate"
  | "ignored"
  | "no_rule"
  | "replied"
  | "forwarded"
  | "error";

export type InboundResult = {
  outcome: InboundOutcome;
  detail: string | null;
  retryable: boolean;
};
