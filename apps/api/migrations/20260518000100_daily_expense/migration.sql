CREATE TABLE "DailyExpense" (
    "id" UUID NOT NULL,
    "date" TEXT NOT NULL DEFAULT '',
    "concept" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "DailyExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DailyExpense_date_idx" ON "DailyExpense"("date");
CREATE INDEX "DailyExpense_concept_idx" ON "DailyExpense"("concept");
