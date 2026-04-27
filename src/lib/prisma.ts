/**
 * Compatibility shim: exposes `getDb()` under the legacy `prisma` export name.
 * All actual database access now goes through src/lib/db.ts.
 */
export { getDb as prisma } from './db';
