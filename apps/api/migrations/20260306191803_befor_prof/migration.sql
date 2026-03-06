/*
  Warnings:

  - You are about to drop the `rawMaterial` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `notes` on table `DailyCloseRaw` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DailyClose" ADD COLUMN     "closedBy" UUID,
ADD COLUMN     "cogsCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "costingStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "costingWarnings" JSONB,
ADD COLUMN     "grossMarginBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "grossProfitCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DailyCloseRaw" ALTER COLUMN "notes" SET NOT NULL,
ALTER COLUMN "notes" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "images" JSONB,
ADD COLUMN     "rawCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "timeProcess" SET DEFAULT '30';

-- DropTable
DROP TABLE "rawMaterial";

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'SYNC_DAILY_CLOSE',
    "status" TEXT NOT NULL DEFAULT 'FAILED',
    "deviceId" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "rawId" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "payloadSnapshot" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterial" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'u',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterialPurchase" (
    "id" UUID NOT NULL,
    "rawMaterial" UUID,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "unitCostCents" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RawMaterialPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRecipeItem" (
    "id" UUID NOT NULL,
    "product" UUID,
    "rawMaterial" UUID,
    "qtyPerProduct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wastePct" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductRecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSchedule" (
    "id" UUID NOT NULL,
    "user" UUID,
    "days" JSONB DEFAULT '[]',
    "shiftStart" TEXT NOT NULL DEFAULT '',
    "shiftEnd" TEXT NOT NULL DEFAULT '',
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncLog_deviceId_idx" ON "SyncLog"("deviceId");

-- CreateIndex
CREATE INDEX "SyncLog_date_idx" ON "SyncLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RawMaterial_name_key" ON "RawMaterial"("name");

-- CreateIndex
CREATE INDEX "RawMaterialPurchase_rawMaterial_idx" ON "RawMaterialPurchase"("rawMaterial");

-- CreateIndex
CREATE INDEX "ProductRecipeItem_product_idx" ON "ProductRecipeItem"("product");

-- CreateIndex
CREATE INDEX "ProductRecipeItem_rawMaterial_idx" ON "ProductRecipeItem"("rawMaterial");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSchedule_user_key" ON "EmployeeSchedule"("user");

-- CreateIndex
CREATE INDEX "DailyClose_closedBy_idx" ON "DailyClose"("closedBy");

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- AddForeignKey
ALTER TABLE "DailyClose" ADD CONSTRAINT "DailyClose_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialPurchase" ADD CONSTRAINT "RawMaterialPurchase_rawMaterial_fkey" FOREIGN KEY ("rawMaterial") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipeItem" ADD CONSTRAINT "ProductRecipeItem_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRecipeItem" ADD CONSTRAINT "ProductRecipeItem_rawMaterial_fkey" FOREIGN KEY ("rawMaterial") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSchedule" ADD CONSTRAINT "EmployeeSchedule_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
