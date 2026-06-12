import { recordDebugLog } from "./debugLogStore.js";

export type SessionIssue = {
  detected: boolean;
  reason: string | null;
  count: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastMessage: string | null;
};

const SESSION_ISSUE_PATTERNS = [
  "bad mac",
  "failed to decrypt",
  "no session found to decrypt",
  "session error",
];

let currentIssue: SessionIssue = {
  detected: false,
  reason: null,
  count: 0,
  firstSeenAt: null,
  lastSeenAt: null,
  lastMessage: null,
};

export function isSessionIssueMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return SESSION_ISSUE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function recordSessionIssue(params: {
  reason: string;
  message: string;
}): SessionIssue {
  const now = new Date().toISOString();
  currentIssue = {
    detected: true,
    reason: params.reason,
    count: currentIssue.count + 1,
    firstSeenAt: currentIssue.firstSeenAt ?? now,
    lastSeenAt: now,
    lastMessage:
      params.message.length > 500
        ? `${params.message.slice(0, 500)}...`
        : params.message,
  };

  recordDebugLog({
    level: "error",
    event: "whatsapp_session_issue_detected",
    data: currentIssue,
  });

  return currentIssue;
}

export function getSessionIssue(): SessionIssue {
  return { ...currentIssue };
}

export function resetSessionIssue(): void {
  currentIssue = {
    detected: false,
    reason: null,
    count: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    lastMessage: null,
  };
}
