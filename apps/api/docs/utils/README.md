# Utils

## upsertByFindFirst

`upsertByFindFirst` provides a simple manual-upsert flow for Prisma models when you do not have a unique selector for `upsert`.

### Signature

```ts
upsertByFindFirst(delegate, where, createData, updateData);
```

### Parameters

- `delegate`: A Prisma model delegate (example: `context.prisma.dailyCloseRaw`).
- `where`: A `findFirst` filter object to locate an existing record.
- `createData`: Data passed to `create` when no record is found.
- `updateData`: Data passed to `update` when a record is found.

### Example

```ts
import { upsertByFindFirst } from "../../lib/utils";

await upsertByFindFirst(
  context.prisma.dailyCloseRaw,
  { deviceId: args.deviceId, date: args.date },
  {
    deviceId: args.deviceId,
    date: args.date,
    payload: args.payload,
    status: "RECEIVED",
    receivedAt: new Date(syncedAt),
  },
  {
    payload: args.payload,
    status: "RECEIVED",
    receivedAt: new Date(syncedAt),
    errorMessage: null,
    processedAt: null,
  },
);
```

### Notes

- This is not race-safe without a unique constraint. If two requests run concurrently, duplicates can be created.
- Prefer a DB unique constraint + Prisma `upsert` when possible.
