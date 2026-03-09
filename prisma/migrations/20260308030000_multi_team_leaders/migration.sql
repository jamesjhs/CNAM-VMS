-- Add isLeader flag to user_teams to support multiple team admins per team
ALTER TABLE "user_teams" ADD COLUMN "isLeader" BOOLEAN NOT NULL DEFAULT false;

-- Remove the single-leader FK from teams
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_leaderId_fkey";
ALTER TABLE "teams" DROP COLUMN IF EXISTS "leaderId";
