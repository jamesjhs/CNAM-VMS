/**
 * Next.js server instrumentation — runs once on process startup.
 * Logs the application version and SMTP configuration so that the server
 * state is immediately visible in `pm2 logs` without needing to trigger
 * an email send.
 *
 * This file is automatically discovered by Next.js (no config change needed).
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Keep in sync with the "version" field in package.json.
const APP_VERSION = '0.6.3';

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
}
