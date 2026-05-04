/**
 * scripts/migrate-remove-account-type.ts
 *
 * One-time migration that:
 *  1. Ensures the Staff system role exists (with staff:* capabilities).
 *  2. Migrates training_policy_roles from accountType TEXT to roleId FK.
 *  3. Drops the accountType column from the users table.
 *
 * The script is idempotent — it detects whether each step has already been
 * applied and skips it gracefully, so it is safe to run on every build.
 *
 * Run automatically via the `prebuild` npm script.
 */

import './load-env';
import { getDb, now } from '../src/lib/db';
import { createId } from '@paralleldrive/cuid2';

function upsertRole(
  db: ReturnType<typeof getDb>,
  name: string,
  description: string,
  isSystem: boolean,
): string {
  const existing = db.prepare('SELECT id FROM roles WHERE name = ?').get(name) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE roles SET description=?, isSystem=?, updatedAt=? WHERE id=?').run(
      description, isSystem ? 1 : 0, now(), existing.id,
    );
    return existing.id;
  }
  const id = createId();
  const ts = now();
  db.prepare(
    'INSERT INTO roles (id, name, description, isSystem, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
  ).run(id, name, description, isSystem ? 1 : 0, ts, ts);
  return id;
}

function ensureCapability(db: ReturnType<typeof getDb>, key: string): string | undefined {
  const row = db.prepare('SELECT id FROM capabilities WHERE key = ?').get(key) as { id: string } | undefined;
  return row?.id;
}

async function main() {
  const db = getDb();

  // ── Step 1: Ensure Staff role exists ────────────────────────────────────────
  const staffRoleId = upsertRole(db, 'Staff', 'Staff member with coordination access', true);

  const staffCapKeys = [
    'staff:volunteer.read',
    'staff:projects.read',
    'staff:messaging.write',
    'staff:schedule.read',
  ];
  for (const key of staffCapKeys) {
    const capId = ensureCapability(db, key);
    if (capId) {
      db.prepare('INSERT OR IGNORE INTO role_capabilities (roleId, capabilityId) VALUES (?,?)').run(
        staffRoleId, capId,
      );
    }
  }
  console.log('✅ Staff role ensured');

  // ── Step 2: Migrate training_policy_roles (accountType → roleId) ─────────────
  // Detect whether the migration is needed by checking the column names.
  const tprInfo = db.prepare("PRAGMA table_info(training_policy_roles)").all() as { name: string }[];
  const hasAccountTypeCol = tprInfo.some((c) => c.name === 'accountType');
  const hasRoleIdCol = tprInfo.some((c) => c.name === 'roleId');

  if (hasAccountTypeCol && !hasRoleIdCol) {
    // Build a mapping of role name → roleId for the three legacy accountType values.
    const accountTypeToRoleName: Record<string, string> = {
      VOLUNTEER: 'Volunteer',
      STAFF: 'Staff',
      MEMBER: 'Volunteer', // no Member role; map to Volunteer as the closest equivalent
    };

    const roleNameToId = new Map<string, string>();
    for (const roleName of ['Volunteer', 'Staff']) {
      const row = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName) as { id: string } | undefined;
      if (row) roleNameToId.set(roleName, row.id);
    }

    // Read existing assignments before we recreate the table.
    const oldRows = db.prepare('SELECT policyId, accountType FROM training_policy_roles').all() as {
      policyId: string; accountType: string;
    }[];

    // Recreate the table with the new schema inside a transaction.
    db.transaction(() => {
      db.exec('DROP TABLE IF EXISTS training_policy_roles_new');
      db.exec(`
        CREATE TABLE training_policy_roles_new (
          policyId TEXT NOT NULL REFERENCES training_policies(id) ON DELETE CASCADE,
          roleId   TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
          PRIMARY KEY(policyId, roleId)
        )
      `);

      for (const row of oldRows) {
        const roleName = accountTypeToRoleName[row.accountType];
        if (!roleName) continue;
        const roleId = roleNameToId.get(roleName);
        if (!roleId) continue;
        db.prepare(
          'INSERT OR IGNORE INTO training_policy_roles_new (policyId, roleId) VALUES (?,?)',
        ).run(row.policyId, roleId);
      }

      db.exec('DROP TABLE training_policy_roles');
      db.exec('ALTER TABLE training_policy_roles_new RENAME TO training_policy_roles');
    })();

    console.log(`✅ training_policy_roles migrated (${oldRows.length} rows → roleId)`);
  } else if (hasRoleIdCol) {
    console.log('ℹ️  training_policy_roles already uses roleId — skipping');
  }

  // ── Step 3: Drop accountType from users table ────────────────────────────────
  const usersInfo = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  const hasAccountTypeOnUsers = usersInfo.some((c) => c.name === 'accountType');

  if (hasAccountTypeOnUsers) {
    // SQLite requires full table reconstruction to drop a column.
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          id                 TEXT PRIMARY KEY NOT NULL,
          email              TEXT UNIQUE NOT NULL,
          name               TEXT,
          emailVerified      TEXT,
          image              TEXT,
          status             TEXT NOT NULL DEFAULT 'PENDING',
          passwordHash       TEXT,
          mustChangePassword INTEGER NOT NULL DEFAULT 0,
          createdAt          TEXT NOT NULL,
          updatedAt          TEXT NOT NULL
        )
      `);

      db.exec(`
        INSERT INTO users_new
          (id, email, name, emailVerified, image, status, passwordHash, mustChangePassword, createdAt, updatedAt)
        SELECT
          id, email, name, emailVerified, image, status, passwordHash, mustChangePassword, createdAt, updatedAt
        FROM users
      `);

      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_new RENAME TO users');
    })();

    console.log('✅ accountType column removed from users');
  } else {
    console.log('ℹ️  users.accountType already absent — skipping');
  }

  console.log('🎉 Migration complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
