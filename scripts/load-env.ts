/**
 * scripts/load-env.ts
 *
 * Loads the project's .env file into process.env so that ts-node scripts can
 * access DB_ENCRYPTION_KEY and other settings.  Next.js does this
 * automatically at runtime, but ts-node does not, so scripts must call this
 * before opening the database.
 *
 * Shell environment variables always take precedence over .env values.
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const envCandidates = [
  process.env.ENV_FILE,
  process.env.APP_ROOT ? resolve(process.env.APP_ROOT, 'shared/.env') : null,
  resolve(process.cwd(), '../shared/.env'),
  resolve(process.cwd(), 'shared/.env'),
  resolve(process.cwd(), '.env'),
].filter((candidate): candidate is string => !!candidate);

const envPath = envCandidates.find((candidate) => existsSync(candidate));

if (envPath) {
  config({ path: envPath, override: false });
}
