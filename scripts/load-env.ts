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
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env'), override: false });
