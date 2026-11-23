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
  const overdue = remainingMs < 0;
  const totalSeconds = Math.floor(Math.abs(remainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const clock = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return overdue ? `-${clock}` : clock;
}

export function isAssignmentCountdownWarning(remainingMs: number) {
  return remainingMs <= ASSIGNMENT_WARNING_MS;
}

export const OWNER_ALERT_EVERY_MINUTES = 10;
export const OWNER_ALERT_EVERY_MS = OWNER_ALERT_EVERY_MINUTES * 60_000;

export function dueOwnerAlertSteps(remainingMs: number) {
  if (remainingMs > 0) return [];
  const overdueMs = Math.max(0, -remainingMs);
  const latest =
    Math.floor(overdueMs / OWNER_ALERT_EVERY_MS) * OWNER_ALERT_EVERY_MINUTES;
  const steps: number[] = [];
  for (let step = 0; step <= latest; step += OWNER_ALERT_EVERY_MINUTES) {
    steps.push(step);
  }
  return steps;
}
