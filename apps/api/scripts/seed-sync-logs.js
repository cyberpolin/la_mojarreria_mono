const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const now = new Date();

const seedRows = [
  {
    createdAt: new Date(now.getTime() - 1000 * 60 * 3),
    type: "SYNC_DAILY_CLOSE",
    status: "FAILED",
    deviceId: "seed-kiosk-001",
    date: "2026-02-24",
    rawId: "raw-seed-001",
    errorMessage: "GraphQL timeout while writing DailyCloseRaw",
    payloadSnapshot: { step: "upsertDailyCloseRaw", reason: "timeout" },
    retryCount: 0,
  },
  {
    createdAt: new Date(now.getTime() - 1000 * 60 * 7),
    type: "SYNC_DAILY_CLOSE",
    status: "FAILED",
    deviceId: "seed-kiosk-002",
    date: "2026-02-24",
    rawId: "raw-seed-002",
    errorMessage: "Validation error: date must match YYYY-MM-DD",
    payloadSnapshot: { step: "validation", field: "date" },
    retryCount: 0,
  },
  {
    createdAt: new Date(now.getTime() - 1000 * 60 * 11),
    type: "SYNC_DAILY_CLOSE",
    status: "FAILED",
    deviceId: "seed-kiosk-003",
    date: "2026-02-23",
    rawId: "raw-seed-003",
    errorMessage: "Database deadlock detected",
    payloadSnapshot: { step: "prisma.upsert", code: "40P01" },
    retryCount: 0,
  },
  {
    createdAt: new Date(now.getTime() - 1000 * 60 * 16),
    type: "SYNC_DAILY_CLOSE",
    status: "SUCCESS",
    deviceId: "seed-kiosk-004",
    date: "2026-02-24",
    rawId: "raw-seed-004",
    errorMessage: null,
    payloadSnapshot: { step: "upsertDailyCloseRaw", result: "ok" },
    retryCount: 0,
  },
  {
    createdAt: new Date(now.getTime() - 1000 * 60 * 25),
    type: "SYNC_OTHER",
    status: "FAILED",
    deviceId: "seed-kiosk-001",
    date: null,
    rawId: null,
    errorMessage: "Unknown sync channel failed",
    payloadSnapshot: { channel: "legacy", action: "sync" },
    retryCount: 0,
  },
  {
    createdAt: new Date(now.getTime() - 1000 * 60 * 35),
    type: "SYNC_DAILY_CLOSE",
    status: "SUCCESS",
    deviceId: "seed-kiosk-002",
    date: "2026-02-23",
    rawId: "raw-seed-005",
    errorMessage: null,
    payloadSnapshot: { step: "processDailyCloseRaw", result: "processed" },
    retryCount: 0,
  },
];

async function main() {
  await prisma.syncLog.deleteMany({
    where: {
      OR: [
        { deviceId: { startsWith: "seed-kiosk-" } },
        { rawId: { startsWith: "raw-seed-" } },
      ],
    },
  });

  await prisma.syncLog.createMany({ data: seedRows });

  console.log(`Seeded ${seedRows.length} SyncLog rows.`);
}

main()
  .catch((error) => {
    console.error("Failed to seed SyncLog rows:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
