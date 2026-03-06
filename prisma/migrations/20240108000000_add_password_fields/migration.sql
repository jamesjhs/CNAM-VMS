-- Add password authentication fields to users

ALTER TABLE "users"
  ADD COLUMN "passwordHash"       TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
