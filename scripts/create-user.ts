/**
 * scripts/create-user.ts
 *
 * Create a new user account directly in the database.
 * Useful for setting up an initial administrator or adding accounts without
 * going through the web UI.
 *
 * Usage — interactive (prompts for all fields):
 *   npm run db:create-user
 *
 * Usage — non-interactive (all values supplied as arguments):
 *   npm run db:create-user -- --email admin@example.com --name "Admin User" --password "Pass123!" --role Root
 *
 * Options:
 *   --email,    -e <email>     Email address for the new account (required)
 *   --name,     -n <name>      Display name (optional)
 *   --password, -p <password>  Initial password (minimum 8 characters)
 *   --role,     -r <role>      Role name to assign, e.g. Root, Admin, Volunteer
 *                              Run  npm run db:seed  first to create system roles.
 *   --status,   -s <status>    Account status (default: ACTIVE)
 */

import './load-env';
import { createInterface } from 'readline';
import { ask } from './lib/prompt';
import { getDb, now } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { createId } from '@paralleldrive/cuid2';

interface Args {
  email?: string;
  name?: string;
  password?: string;
  role?: string;
  status?: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const result: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--email' || a === '-e') && argv[i + 1]) {
      result.email = argv[++i];
    } else if ((a === '--name' || a === '-n') && argv[i + 1]) {
      result.name = argv[++i];
    } else if ((a === '--password' || a === '-p') && argv[i + 1]) {
      result.password = argv[++i];
    } else if ((a === '--role' || a === '-r') && argv[i + 1]) {
      result.role = argv[++i];
    } else if ((a === '--status' || a === '-s') && argv[i + 1]) {
      result.status = argv[++i];
    }
  }
  return result;
}

async function main() {
  const args = parseArgs();
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let email = args.email?.toLowerCase().trim();
  let name = args.name?.trim();
  let password = args.password;
  let roleName = args.role?.trim();

  if (!email) {
    email = (await ask(rl, 'Email address: ')).toLowerCase().trim();
  }
  if (!email) {
    console.error('\n❌  Email address is required.');
    rl.close();
    process.exit(1);
  }

  if (!name) {
    name = (await ask(rl, 'Full name (optional, press Enter to skip): ')).trim();
  }

  if (!password) {
    password = (await ask(rl, 'Password (min 8 chars): ')).trim();
  }

  const db = getDb();
  const availableRoles = (
    db.prepare('SELECT name FROM roles ORDER BY name').all() as { name: string }[]
  ).map((r) => r.name);

  if (!roleName) {
    if (availableRoles.length > 0) {
      console.log(`\nAvailable roles: ${availableRoles.join(', ')}`);
      roleName = (await ask(rl, 'Role to assign (leave blank to skip): ')).trim();
    } else {
      console.log('\n⚠️  No roles found — run  npm run db:seed  to create system roles.');
    }
  }

  rl.close();

  if (!password || password.length < 8) {
    console.error('\n❌  Password must be at least 8 characters.');
    process.exit(1);
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    console.error(`\n❌  A user with email ${email} already exists.`);
    console.error('    Use  npm run db:reset-password  to change their password instead.\n');
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const ts = now();
  const id = createId();
  const status = args.status ?? 'ACTIVE';

  db.prepare(
    'INSERT INTO users (id, email, name, status, mustChangePassword, passwordHash, createdAt, updatedAt) VALUES (?,?,?,?,0,?,?,?)',
  ).run(id, email, name || null, status, hash, ts, ts);

  db.prepare(
    'INSERT INTO audit_logs (id, userId, action, resource, resourceId, detail, createdAt) VALUES (?,?,?,?,?,?,?)',
  ).run(
    createId(), id, 'USER_CREATED_BY_SCRIPT', 'User', id,
    JSON.stringify({ note: 'User created via CLI create-user script' }), ts,
  );

  let roleAssigned = false;
  if (roleName) {
    const role = db.prepare(
      'SELECT id, name FROM roles WHERE name = ? COLLATE NOCASE',
    ).get(roleName) as { id: string; name: string } | undefined;

    if (role) {
      db.prepare(
        'INSERT OR IGNORE INTO user_roles (userId, roleId, grantedAt) VALUES (?,?,?)',
      ).run(id, role.id, ts);
      roleAssigned = true;
      roleName = role.name; // use the canonical casing from the DB
    } else {
      console.warn(`\n⚠️  Role "${roleName}" not found — user created without a role.`);
      console.warn(`    Available roles: ${availableRoles.join(', ') || '(none — run db:seed first)'}`);
    }
  }

  console.log(`\n✅  User created successfully.`);
  console.log(`\n    Email:    ${email}`);
  console.log(`    Name:     ${name || '(none)'}`);
  console.log(`    Password: ${password}`);
  console.log(`    Status:   ${status}`);
  if (roleAssigned) console.log(`    Role:     ${roleName}`);
  console.log(`\n    Sign in at /auth/signin\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
