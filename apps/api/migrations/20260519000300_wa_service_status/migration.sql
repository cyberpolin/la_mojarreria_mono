-- CreateTable
CREATE TABLE "WaServiceStatus" (
    "id" UUID NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'wa-service',
    "instanceId" TEXT NOT NULL DEFAULT 'default',
    "state" TEXT NOT NULL DEFAULT 'INACTIVE',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL DEFAULT '',
    "lastChangedAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "WaServiceStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaServiceStatus_service_instanceId_key" ON "WaServiceStatus"("service", "instanceId");

-- CreateIndex
CREATE INDEX "WaServiceStatus_service_idx" ON "WaServiceStatus"("service");

-- CreateIndex
CREATE INDEX "WaServiceStatus_instanceId_idx" ON "WaServiceStatus"("instanceId");
