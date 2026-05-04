/**
 * scripts/promote-to-root.ts
 *
 * Assign the Root role to an existing user and activate their account.
 * Use this to grant full superadmin access without going through the web UI —
 * for example when recovering access or bootstrapping a second admin account.
 *
 * Usage — interactive (prompts for email):
 *   npm run db:promote-to-root
 *
 * Usage — non-interactive:
 *   npm run db:promote-to-root -- --email user@example.com
 *
 * Options:
 *   --email, -e <email>   Email address of the account to promote
 */

import './load-env';
import { createInterface } from 'readline';
import { ask } from './lib/prompt';
import { getDb, now } from '../src/lib/db';
import { createId } from '@paralleldrive/cuid2';

interface Args {
  email?: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const result: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--email' || a === '-e') && argv[i + 1]) {
      result.email = argv[++i];
    }
  }
  return result;
}

async function main() {
  const args = parseArgs();
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let email = args.email?.toLowerCase().trim();

  if (!email) {
    email = (await ask(rl, 'Email address to promote: ')).toLowerCase().trim();
  }
  rl.close();

  if (!email) {
    console.error('\n❌  Email address is required.');
    process.exit(1);
  }

  const db = getDb();

  type UserRow = { id: string; email: string; name: string | null; status: string };
  const user = db.prepare(
    'SELECT id, email, name, status FROM users WHERE email = ?',
  ).get(email) as UserRow | undefined;

  if (!user) {
    console.error(`\n❌  No user found with email: ${email}`);
    console.error('    Tip: use  npm run db:create-user  to create the account first.\n');
    process.exit(1);
  }

  const rootRole = db.prepare(
    'SELECT id FROM roles WHERE name = ? COLLATE NOCASE',
  ).get('Root') as { id: string } | undefined;

  if (!rootRole) {
    console.error('\n❌  Root role not found in the database.');
    console.error('    Run  npm run db:seed  first to create system roles.\n');
    process.exit(1);
  }

  const ts = now();

  db.transaction(() => {
    // Activate the account if it is not already active
    if (user.status !== 'ACTIVE') {
      db.prepare("UPDATE users SET status='ACTIVE', updatedAt=? WHERE id=?").run(ts, user.id);
    }

    // Assign the Root role (no-op if already assigned)
    db.prepare(
      'INSERT OR IGNORE INTO user_roles (userId, roleId, grantedAt) VALUES (?,?,?)',
    ).run(user.id, rootRole.id, ts);

    db.prepare(
      'INSERT INTO audit_logs (id, userId, action, resource, resourceId, detail, createdAt) VALUES (?,?,?,?,?,?,?)',
    ).run(
      createId(), user.id, 'USER_PROMOTED_TO_ROOT', 'User', user.id,
      JSON.stringify({ note: 'Promoted to Root via CLI promote-to-root script' }), ts,
    );
  })();

  console.log(`\n✅  ${user.email}${user.name ? ` (${user.name})` : ''} has been promoted to Root.`);
  if (user.status !== 'ACTIVE') {
    console.log('    Account status set to ACTIVE.');
  }
  console.log('    Sign in at /auth/signin\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
