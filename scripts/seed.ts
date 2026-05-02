/**
 * scripts/seed.ts
 *
 * Idempotent database seed script. Creates:
 *   - All system capabilities
 *   - Root, Admin, and Volunteer system roles
 *   - Default teams and jobs
 *   - The root user (from ROOT_USER_EMAIL env var)
 *
 * Usage:
 *   npm run db:seed
 */

import './load-env';
import { getDb, now } from '../src/lib/db';
import { CAPABILITIES } from '../src/lib/capabilities';
import { createId } from '@paralleldrive/cuid2';

function upsertCapability(db: ReturnType<typeof getDb>, key: string, description: string): string {
  const existing = db.prepare('SELECT id FROM capabilities WHERE key = ?').get(key) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE capabilities SET description = ? WHERE key = ?').run(description, key);
    return existing.id;
  }
  const id = createId();
  db.prepare('INSERT INTO capabilities (id, key, description, createdAt) VALUES (?,?,?,?)').run(id, key, description, now());
  return id;
}

function upsertRole(db: ReturnType<typeof getDb>, name: string, description: string, isSystem: boolean): string {
  const existing = db.prepare('SELECT id FROM roles WHERE name = ?').get(name) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE roles SET description=?, isSystem=?, updatedAt=? WHERE id=?').run(description, isSystem ? 1 : 0, now(), existing.id);
    return existing.id;
  }
  const id = createId();
  const ts = now();
  db.prepare('INSERT INTO roles (id, name, description, isSystem, createdAt, updatedAt) VALUES (?,?,?,?,?,?)').run(id, name, description, isSystem ? 1 : 0, ts, ts);
  return id;
}

function upsertTeam(db: ReturnType<typeof getDb>, name: string, description: string): void {
  const existing = db.prepare('SELECT id FROM teams WHERE name = ?').get(name);
  if (existing) {
    db.prepare('UPDATE teams SET description=?, updatedAt=? WHERE name=?').run(description, now(), name);
  } else {
    const ts = now();
    db.prepare('INSERT INTO teams (id, name, description, createdAt, updatedAt) VALUES (?,?,?,?,?)').run(createId(), name, description, ts, ts);
  }
}

function upsertJob(db: ReturnType<typeof getDb>, title: string, description: string, isRolling: boolean, colour: string): void {
  const existing = db.prepare('SELECT id FROM jobs WHERE title = ?').get(title);
  if (existing) {
    db.prepare('UPDATE jobs SET description=?, isRolling=?, colour=?, updatedAt=? WHERE title=?').run(description, isRolling ? 1 : 0, colour, now(), title);
  } else {
    const ts = now();
    db.prepare('INSERT INTO jobs (id, title, description, isRolling, colour, scheduleType, weekDays, monthDays, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)').run(
      createId(), title, description, isRolling ? 1 : 0, colour, 'ONE_OFF', '[]', '[]', ts, ts,
    );
  }
}

async function main() {
  const db = getDb();
  const ts = now();

  console.log('🌱 Seeding database...');

  // --- Capabilities ---
  const capMap = new Map<string, string>();
  for (const cap of CAPABILITIES) {
    const id = upsertCapability(db, cap.key, cap.description);
    capMap.set(cap.key, id);
  }
  console.log(`✅ ${CAPABILITIES.length} capabilities`);

  // --- Root role ---
  const rootRoleId = upsertRole(db, 'Root', 'Superadmin with all capabilities', true);
  for (const [, capId] of capMap) {
    db.prepare('INSERT OR IGNORE INTO role_capabilities (roleId, capabilityId) VALUES (?,?)').run(rootRoleId, capId);
  }
  console.log('✅ Root role');

  // --- Admin role ---
  const adminRoleId = upsertRole(db, 'Admin', 'Administrator with user management rights', true);
  const adminCapKeys = ['admin:users.read','admin:users.write','admin:roles.read','admin:teams.read','admin:teams.write','admin:audit.read','admin:training.write','admin:museum.write'];
  for (const key of adminCapKeys) {
    const capId = capMap.get(key);
    if (capId) db.prepare('INSERT OR IGNORE INTO role_capabilities (roleId, capabilityId) VALUES (?,?)').run(adminRoleId, capId);
  }
  console.log('✅ Admin role');

  // --- Volunteer role ---
  const volunteerRoleId = upsertRole(db, 'Volunteer', 'Standard volunteer', true);
  const volunteerCapKeys = ['volunteer:tasks.read'];
  for (const key of volunteerCapKeys) {
    const capId = capMap.get(key);
    if (capId) db.prepare('INSERT OR IGNORE INTO role_capabilities (roleId, capabilityId) VALUES (?,?)').run(volunteerRoleId, capId);
  }
  console.log('✅ Volunteer role');

  // --- Default teams ---
  const defaultTeams = [
    { name: 'Aircraft Restoration', description: 'Restoring and maintaining the museum aircraft collection' },
    { name: 'Visitor Services', description: 'Front-of-house and visitor experience' },
    { name: 'Education & Outreach', description: 'School visits and community engagement' },
    { name: 'Grounds & Facilities', description: 'Site maintenance and facilities management' },
    { name: 'Events & Fundraising', description: 'Special events and fundraising activities' },
  ];
  for (const team of defaultTeams) upsertTeam(db, team.name, team.description);
  console.log(`✅ ${defaultTeams.length} default teams`);

  // --- Default jobs ---
  const defaultJobs = [
    { title: 'Grass Cutting', description: 'Maintaining the museum grounds and lawns', isRolling: true, colour: '#22c55e' },
    { title: 'Airframe Washing', description: 'Washing and cleaning aircraft airframes', isRolling: true, colour: '#3b82f6' },
    { title: 'Front of House Greeting', description: 'Welcoming visitors at the museum entrance', isRolling: true, colour: '#f59e0b' },
    { title: 'Interior Cleaning', description: 'Cleaning inside the museum buildings and facilities', isRolling: true, colour: '#14b8a6' },
    { title: 'Shop Staff', description: 'Serving customers in the museum gift shop', isRolling: false, colour: '#ec4899' },
    { title: 'Aircraft Guide', description: 'Guiding visitors around the aircraft collection', isRolling: false, colour: '#6366f1' },
    { title: 'Tearoom Helper', description: 'Helping in the museum tearoom/café', isRolling: false, colour: '#a855f7' },
  ];
  for (const job of defaultJobs) upsertJob(db, job.title, job.description, job.isRolling, job.colour);
  console.log(`✅ ${defaultJobs.length} default jobs`);

  // --- Root user ---
  const rootEmail = process.env.ROOT_USER_EMAIL;
  const rootName = process.env.ROOT_USER_NAME ?? 'Root Admin';

  if (!rootEmail) {
    console.log('⚠️  ROOT_USER_EMAIL not set, skipping root user creation');
  } else {
    const normalizedEmail = rootEmail.toLowerCase().trim();
    let rootUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as { id: string } | undefined;
    if (rootUser) {
      db.prepare("UPDATE users SET name=?, status='ACTIVE', updatedAt=? WHERE id=?").run(rootName, ts, rootUser.id);
    } else {
      const id = createId();
      db.prepare("INSERT INTO users (id, email, name, status, createdAt, updatedAt) VALUES (?,?,?,'ACTIVE',?,?)").run(id, normalizedEmail, rootName, ts, ts);
      rootUser = { id };
    }
    db.prepare('INSERT OR IGNORE INTO user_roles (userId, roleId, grantedAt) VALUES (?,?,?)').run(rootUser.id, rootRoleId, ts);
    console.log(`✅ Root user: ${normalizedEmail}`);
  }

  console.log('🎉 Seeding complete!');
}

main().catch((e) => { console.error(e); process.exit(1); });
