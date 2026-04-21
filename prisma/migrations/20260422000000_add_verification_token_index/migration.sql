-- The auth flow issues multiple COUNT / findFirst queries against
-- verification_tokens filtered by (identifier, expires).  The existing
-- unique index on (identifier, token) does not cover the expires column,
-- so those queries performed sequential scans.  This composite index
-- eliminates that bottleneck.
CREATE INDEX IF NOT EXISTS "verification_tokens_identifier_expires_idx"
  ON "verification_tokens" ("identifier", "expires");
