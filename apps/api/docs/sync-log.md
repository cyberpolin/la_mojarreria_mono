# SyncLog

`SyncLog` stores sync outcomes for observability in production.

## Environment flags

- `SYNC_LOG_SUCCESS=true` to persist successful sync attempts.
- `SYNC_LOG_USE_RETRY_COUNTER=true` to update and increment `retryCount` on repeated failures for same `type + deviceId + date`.

By default both are disabled.

## Example usage

```ts
await logSyncResult({
  context,
  type: "SYNC_DAILY_CLOSE",
  status: "FAILED",
  deviceId,
  date: payload.date,
  rawId,
  errorMessage: "GraphQL timeout",
  payload,
  useRetryCounter: false,
});
```

`logSyncResult` is best-effort and never throws to the main sync flow.
