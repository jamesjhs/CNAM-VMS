-- Add job recurrence fields so jobs can repeat on certain days of the week or month

-- CreateEnum
CREATE TYPE "JobScheduleType" AS ENUM ('ONE_OFF', 'WEEKLY', 'MONTHLY');

-- AlterTable: add recurrence columns to jobs
ALTER TABLE "jobs"
  ADD COLUMN "scheduleType"      "JobScheduleType" NOT NULL DEFAULT 'ONE_OFF',
  ADD COLUMN "weekDays"          INTEGER[]         NOT NULL DEFAULT '{}',
  ADD COLUMN "monthDays"         INTEGER[]         NOT NULL DEFAULT '{}',
  ADD COLUMN "defaultStartTime"  TEXT,
  ADD COLUMN "defaultEndTime"    TEXT,
  ADD COLUMN "defaultMaxSignups" INTEGER;
