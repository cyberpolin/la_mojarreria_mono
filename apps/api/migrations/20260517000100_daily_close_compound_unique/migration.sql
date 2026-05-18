DROP INDEX IF EXISTS "DailyClose_deviceId_key";
DROP INDEX IF EXISTS "DailyClose_date_key";

CREATE INDEX IF NOT EXISTS "DailyClose_deviceId_idx" ON "DailyClose"("deviceId");
CREATE INDEX IF NOT EXISTS "DailyClose_date_idx" ON "DailyClose"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "DailyClose_deviceId_date_key" ON "DailyClose"("deviceId", "date");
