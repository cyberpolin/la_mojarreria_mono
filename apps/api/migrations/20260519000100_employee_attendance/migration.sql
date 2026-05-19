CREATE TABLE "EmployeeDeviceAssignment" (
    "id" UUID NOT NULL,
    "user" UUID,
    "deviceId" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeDeviceAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceLog" (
    "id" UUID NOT NULL,
    "user" UUID,
    "deviceId" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "clockInAt" TIMESTAMP(3),
    "clockOutAt" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'mobile',
    "checkInMutationId" TEXT NOT NULL DEFAULT '',
    "checkOutMutationId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "AttendanceLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeDeviceAssignment_user_key" ON "EmployeeDeviceAssignment"("user");
CREATE INDEX "EmployeeDeviceAssignment_deviceId_idx" ON "EmployeeDeviceAssignment"("deviceId");

CREATE UNIQUE INDEX "AttendanceLog_checkInMutationId_key" ON "AttendanceLog"("checkInMutationId");
CREATE UNIQUE INDEX "AttendanceLog_checkOutMutationId_key" ON "AttendanceLog"("checkOutMutationId");
CREATE INDEX "AttendanceLog_user_idx" ON "AttendanceLog"("user");
CREATE INDEX "AttendanceLog_deviceId_idx" ON "AttendanceLog"("deviceId");
CREATE INDEX "AttendanceLog_date_idx" ON "AttendanceLog"("date");

ALTER TABLE "EmployeeDeviceAssignment" ADD CONSTRAINT "EmployeeDeviceAssignment_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
