-- AlterTable
ALTER TABLE "DailyClose" ADD COLUMN     "allocatedFixedExpensesCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fixedExpenseRatioBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "operatingMarginBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "operatingProfitCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FixedOperatingExpense" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "renewalDays" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "FixedOperatingExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FixedOperatingExpense_name_key" ON "FixedOperatingExpense"("name");
