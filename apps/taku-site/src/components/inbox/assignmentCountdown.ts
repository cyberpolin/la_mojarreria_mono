import { ESTIMATED_DELIVERY_MINUTES } from "./raiseOrder";

export const ASSIGNMENT_COUNTDOWN_MINUTES = ESTIMATED_DELIVERY_MINUTES;
export const ASSIGNMENT_WARNING_MINUTES = 10;
export const ASSIGNMENT_WARNING_MS = ASSIGNMENT_WARNING_MINUTES * 60_000;

export function assignmentRemainingMs(
  assignedAt: string,
  now = Date.now(),
  durationMinutes = ASSIGNMENT_COUNTDOWN_MINUTES,
) {
  const start = Date.parse(assignedAt);
  if (Number.isNaN(start)) return null;
  return start + durationMinutes * 60_000 - now;
}

export function formatAssignmentCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function isAssignmentCountdownWarning(remainingMs: number) {
  return remainingMs <= ASSIGNMENT_WARNING_MS;
}
