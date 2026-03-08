-- Add new enums
CREATE TYPE "TaskType" AS ENUM ('SITE', 'DISPLAY', 'AIRFRAME');
CREATE TYPE "TaskUrgency" AS ENUM ('ROUTINE', 'MODERATE', 'URGENT');

-- Add leaderId to teams
ALTER TABLE "teams" ADD COLUMN "leaderId" TEXT;
ALTER TABLE "teams" ADD CONSTRAINT "teams_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create team_tasks table
CREATE TABLE "team_tasks" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "taskType" "TaskType" NOT NULL,
    "urgency" "TaskUrgency" NOT NULL,
    "description" TEXT,
    "personnelRequired" INTEGER,
    "supervisorRequired" BOOLEAN NOT NULL DEFAULT false,
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "equipmentOther" TEXT,
    "consumables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consumablesOther" TEXT,
    "safetyIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "safetyIssuesOther" TEXT,
    "equipmentLocations" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "team_tasks" ADD CONSTRAINT "team_tasks_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create team_work_logs table
CREATE TABLE "team_work_logs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entry" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_work_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "team_work_logs" ADD CONSTRAINT "team_work_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "team_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_work_logs" ADD CONSTRAINT "team_work_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create team_feedback table
CREATE TABLE "team_feedback" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_feedback_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "team_feedback" ADD CONSTRAINT "team_feedback_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_feedback" ADD CONSTRAINT "team_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
