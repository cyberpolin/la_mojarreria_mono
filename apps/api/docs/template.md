# Contract: <NAME>

> Location: `docs/contracts/<name>.md`  
> Example: `docs/contracts/daily-close.md`

---

## 1. Purpose

What problem this solves and why it exists.

- Who uses it
- Why it matters
- What breaks if it’s wrong

(Keep this to 2–3 lines.)

---

## 2. Scope

What this contract explicitly covers and what it does not.

### In scope

- …

### Out of scope

- …

(This prevents silent scope creep.)

---

## 3. Consumers

Who depends on this contract.

- Mobile app (kiosk / tablet)
- Backend processors
- Dashboards / analytics (indirect)

---

## 4. Submission / Invocation Rules

How and when this can be called.

- Allowed frequency (once per X, retryable, etc.)
- Idempotency rules
- Ordering guarantees (if any)

(Be explicit. This is where most bugs are born.)

---

## 5. Input Contract

Exact shape and constraints of inputs.

| Field         | Type        | Required | Notes                 |
| ------------- | ----------- | -------- | --------------------- |
| deviceId      | string      | yes      | Unique per device     |
| date          | YYYY-MM-DD  | yes      | Business date         |
| payload       | JSON object | yes      | Stored as-is          |
| schemaVersion | number      | no       | Defaulted server-side |

---

## 6. Output Contract

What the caller can rely on.

| Field      | Type       | Notes             |
| ---------- | ---------- | ----------------- |
| id         | string     | Record identifier |
| status     | enum       | RECEIVED          |
| receivedAt | ISO string | Server timestamp  |

(Never over-promise here.)

---

## 7. Invariants (Non-Negotiables)

Things that must always be true.

- …
- …
- …

(If any of these break, the system is broken.)

---

## 8. State Machine

Allowed states and transitions.

- Terminal states: PROCESSED, FAILED
- This API only creates RECEIVED

---

## 9. Failure Semantics

How failures are communicated.

| Scenario             | Behavior          |
| -------------------- | ----------------- |
| Invalid input        | BAD_USER_INPUT    |
| Duplicate submission | ALREADY_SUBMITTED |
| Database failure     | INTERNAL_ERROR    |

(No silent overwrites.)

---

## 10. Versioning & Evolution

How this contract can change safely.

- Payload versioned via `schemaVersion`
- Backward compatibility expected for N versions
- Breaking changes require new mutation or version bump

---

## 11. Observability (Optional but Recommended)

How this is debugged in production.

- Logged keys (e.g. deviceId, date, recordId)
- Metrics (e.g. submissions/day, failures/day)
- Alerts (e.g. stuck in RECEIVED > X time)

---

## 12. Open Questions / Future Work

Known gaps or deferred decisions.

- …
- …

---

## Notes

- Keep this document under one page.
- Update only when **semantics change**, not implementation details.
- Treat this as part of the API, not documentation fluff.
