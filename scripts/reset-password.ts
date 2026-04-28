/**
 * scripts/reset-password.ts
 *
 * Directly reset the password for any user account in the database.
 * Use this to recover access when email-based password reset is unavailable
 * or when no users exist yet (i.e. if db:seed / db:set-initial-password were
 * never run against the correct database file).
 *
 * Usage — interactive (prompts for email and new password):
 *   npm run db:reset-password
 *
 * Usage — non-interactive (all values supplied as arguments):
 *   npm run db:reset-password -- --email admin@example.com --password "NewPass123!"
 *
 * Options:
 *   --email,    -e <email>     Email address of the account to update
 *   --password, -p <password>  New password (minimum 8 characters)
 *   --force-change             Set mustChangePassword=1 so the user is prompted
 *                              to choose a new password on their next login
 *                              (default: 0 — no forced change)
 */

import './load-env';
import { createInterface } from 'readline';
import { ask } from './lib/prompt';
import { getDb, now } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { createId } from '@paralleldrive/cuid2';

interface Args {
  email?: string;
  password?: string;
  forceChange: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const result: Args = { forceChange: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--email' || a === '-e') && argv[i + 1]) {
      result.email = argv[++i];
    } else if ((a === '--password' || a === '-p') && argv[i + 1]) {
      result.password = argv[++i];
    } else if (a === '--force-change') {
      result.forceChange = true;
    }
  }
  return result;
}

async function main() {
  const args = parseArgs();
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let email = args.email?.toLowerCase().trim();
  let password = args.password;

  if (!email) {
    email = (await ask(rl, 'Email address: ')).toLowerCase().trim();
  }
  if (!email) {
    console.error('\n❌  Email address is required.');
    rl.close();
    process.exit(1);
  }

  if (!password) {
    password = (await ask(rl, 'New password (min 8 chars): ')).trim();
  }
  rl.close();

  if (!password || password.length < 8) {
    console.error('\n❌  Password must be at least 8 characters.');
    process.exit(1);
  }

  const db = getDb();

  type UserRow = { id: string; email: string; name: string | null; status: string };
  const user = db.prepare(
    'SELECT id, email, name, status FROM users WHERE email = ?',
  ).get(email) as UserRow | undefined;

  if (!user) {
    console.error(`\n❌  No user found with email: ${email}`);
    console.error('    Tip: run  npm run db:seed  first to seed the database,');
    console.error('    or use  npm run db:create-user  to add a brand-new account.\n');
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const ts = now();
  const mustChangePassword = args.forceChange ? 1 : 0;

  db.prepare(
    'UPDATE users SET passwordHash=?, mustChangePassword=?, updatedAt=? WHERE id=?',
  ).run(hash, mustChangePassword, ts, user.id);

  db.prepare(
    'INSERT INTO audit_logs (id, userId, action, resource, resourceId, detail, createdAt) VALUES (?,?,?,?,?,?,?)',
  ).run(
    createId(), user.id, 'PASSWORD_RESET_BY_SCRIPT', 'User', user.id,
    JSON.stringify({ note: 'Password reset via CLI reset-password script' }), ts,
  );

  console.log(`\n✅  Password updated for: ${user.email}${user.name ? ` (${user.name})` : ''}`);
  console.log(`\n    Sign in at /auth/signin with:`);
  console.log(`      Email:    ${user.email}`);
  console.log(`      Password: ${password}`);
  if (mustChangePassword) {
    console.log(`\n    ⚠️  The account will be prompted to change this password on first login.`);
  }
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
