-- Add optional teamId to calendar_events so events can be linked to a team

ALTER TABLE "calendar_events" ADD COLUMN "teamId" TEXT;

ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "teams"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
