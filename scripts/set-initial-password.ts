/**
 * scripts/set-initial-password.ts
 *
 * One-time script that sets the root user password to a default value
 * and marks the account as requiring an immediate password change.
 *
 * Usage:
 *   npm run db:set-initial-password
 *
 * The script is idempotent — it can safely be run multiple times.
 */

import './load-env';
import { getDb, now } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { createId } from '@paralleldrive/cuid2';

async function main() {
  const db = getDb();

  const rootEmail = (process.env.ROOT_USER_EMAIL ?? '').toLowerCase().trim();
  const defaultPassword = process.env.INITIAL_PASSWORD ?? 'password';

  if (!rootEmail) {
    console.error('\n❌  ROOT_USER_EMAIL is not set in the environment.');
    process.exit(1);
  }

  console.log(`\n🔑  Setting initial password for: ${rootEmail}`);

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(rootEmail) as { id: string } | undefined;

  if (!user) {
    console.error(`\n❌  User not found: ${rootEmail}`);
    console.error('    Make sure the root user exists (run npm run db:seed first).');
    process.exit(1);
  }

  const hash = await hashPassword(defaultPassword);
  const ts = now();

  db.prepare('UPDATE users SET passwordHash=?, mustChangePassword=1, updatedAt=? WHERE id=?').run(hash, ts, user.id);
  db.prepare('INSERT INTO audit_logs (id, userId, action, resource, resourceId, detail, createdAt) VALUES (?,?,?,?,?,?,?)').run(
    createId(), user.id, 'PASSWORD_RESET_BY_SCRIPT', 'User', user.id,
    JSON.stringify({ note: 'Initial password set via set-initial-password script' }), ts,
  );

  console.log(`\n✅  Password set successfully.`);
  console.log(`    The account will require a password change on first login.`);
  console.log(`\n    Sign in at /auth/signin with:`);
  console.log(`      Email:    ${rootEmail}`);
  console.log(`      Password: ${defaultPassword}`);
  console.log(`\n    ⚠️  Change this password immediately after signing in!\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
