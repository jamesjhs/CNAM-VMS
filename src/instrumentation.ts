/**
 * Next.js server instrumentation — runs once on process startup.
 * Logs the application version, SMTP configuration, and database status so
 * that the server state is immediately visible in `pm2 logs` without needing
 * to trigger an email send or a login attempt.
 *
 * This file is automatically discovered by Next.js (no config change needed).
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { APP_VERSION } from '@/lib/version';

export async function register() {
  // Only emit logs from the Node.js server runtime.  The edge / middleware
  // runtime also calls register() but has no access to process.env SMTP vars.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const host = process.env.EMAIL_SERVER_HOST;

  if (host) {
    const port    = process.env.EMAIL_SERVER_PORT ?? '587';
    const user    = process.env.EMAIL_SERVER_USER ?? '(not set)';
    const from    = process.env.EMAIL_FROM        ?? '(not set)';
    const secure  = process.env.EMAIL_SERVER_SECURE      === 'true' ? 'implicit-TLS'
                  : process.env.EMAIL_SERVER_REQUIRE_TLS === 'true' ? 'STARTTLS'
                  : 'plain';
    console.log(
      `[server] CNAM VMS v${APP_VERSION} starting — SMTP server details are ` +
      `{ host: "${host}", port: ${port}, user: "${user}", from: "${from}", tls: "${secure}" }`,
    );
  } else {
    console.log(
      `[server] CNAM VMS v${APP_VERSION} starting — SMTP server details are ` +
      `{ host: "(not configured — emails will be written to pm2 logs)" }`,
    );
  }

  // Database health check — open the connection and query basic stats so that
  // path and encryption-key mismatches are surfaced immediately at startup
  // rather than silently causing login failures later.
  try {
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const { n: userCount }   = db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number };
    const { n: activeCount } = db.prepare("SELECT COUNT(*) as n FROM users WHERE status = 'ACTIVE'").get() as { n: number };
    console.log(`[db] Database ready — ${userCount} user(s) total, ${activeCount} ACTIVE`);
    if (userCount === 0) {
      console.warn(
        '[db] WARNING: no users exist — run  npm run db:seed  and then ' +
        'npm run db:set-initial-password  (or  npm run db:create-user) ' +
        'before attempting to sign in.',
      );
    }
  } catch (err) {
    console.error(
      '[db] STARTUP HEALTH CHECK FAILED — login will not work until this is resolved. ' +
      'Common causes: DB_ENCRYPTION_KEY is wrong/missing, DATABASE_URL points to the wrong file, ' +
      'or the database file is corrupt. Error:', err,
    );
  }
}
