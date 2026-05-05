/**
 * SQLite database layer using better-sqlite3-multiple-ciphers.
 *
 * Encryption is applied at database-open time using the DB_ENCRYPTION_KEY
 * environment variable (SQLCipher).  When no key is set the database is
 * unencrypted — useful in development if the variable is omitted.
 *
 * The module follows the global-singleton pattern so that the connection
 * is reused across Next.js hot-module replacement cycles in development.
 */

// better-sqlite3 but ships without its own .d.ts; @types/better-sqlite3 covers it.
import Database from 'better-sqlite3-multiple-ciphers';
import type BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Connection helpers ────────────────────────────────────────────────────

function resolveDbPath(): string {
  const raw = (process.env.DATABASE_URL ?? 'file:./data/cnam-vms.db').trim();
  const filePath = raw.startsWith('file:') ? raw.slice(5) : raw;
  // Use APP_ROOT when set (explicitly passed via ecosystem.config.cjs) so that
  // relative database paths are always resolved from the project root even if
  // the standalone server.js changes process.cwd() internally.
  const base = process.env.APP_ROOT ?? /*turbopackIgnore: true*/ process.cwd();
  return path.resolve(base, filePath);
}

function initSchema(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      emailVerified TEXT,
      image TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      passwordHash TEXT,
      mustChangePassword INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_phones (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      number TEXT NOT NULL,
      label TEXT,
      isPrimary INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_phones_userId ON user_phones(userId);

    CREATE TABLE IF NOT EXISTS volunteer_availability (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activities TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerAccountId TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      UNIQUE(provider, providerAccountId)
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_userId ON accounts(userId);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      sessionToken TEXT UNIQUE NOT NULL,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires TEXT NOT NULL,
      UNIQUE(identifier, token)
    );
    CREATE INDEX IF NOT EXISTS idx_vt_identifier ON verification_tokens(identifier);
    CREATE INDEX IF NOT EXISTS idx_vt_expires ON verification_tokens(expires);

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      isSystem INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS capabilities (
      id TEXT PRIMARY KEY NOT NULL,
      key TEXT UNIQUE NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_capabilities (
      roleId TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      capabilityId TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
      PRIMARY KEY(roleId, capabilityId)
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      roleId TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      grantedAt TEXT NOT NULL,
      grantedBy TEXT,
      PRIMARY KEY(userId, roleId)
    );
    CREATE INDEX IF NOT EXISTS idx_user_roles_userId ON user_roles(userId);

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_teams (
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      teamId TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      isLeader INTEGER NOT NULL DEFAULT 0,
      joinedAt TEXT NOT NULL,
      PRIMARY KEY(userId, teamId)
    );
    CREATE INDEX IF NOT EXISTS idx_user_teams_userId ON user_teams(userId);
    CREATE INDEX IF NOT EXISTS idx_user_teams_teamId ON user_teams(teamId);

    CREATE TABLE IF NOT EXISTS team_join_requests (
      id TEXT PRIMARY KEY NOT NULL,
      teamId TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      requestedAt TEXT NOT NULL,
      resolvedAt TEXT,
      resolvedById TEXT REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(teamId, userId)
    );
    CREATE INDEX IF NOT EXISTS idx_team_join_requests_teamId ON team_join_requests(teamId);
    CREATE INDEX IF NOT EXISTS idx_team_join_requests_userId ON team_join_requests(userId);

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      authorId TEXT REFERENCES users(id) ON DELETE SET NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT UNIQUE NOT NULL,
      description TEXT,
      isRolling INTEGER NOT NULL DEFAULT 0,
      colour TEXT NOT NULL DEFAULT '#6366f1',
      scheduleType TEXT NOT NULL DEFAULT 'ONE_OFF',
      weekDays TEXT NOT NULL DEFAULT '[]',
      monthDays TEXT NOT NULL DEFAULT '[]',
      defaultStartTime TEXT,
      defaultEndTime TEXT,
      defaultMaxSignups INTEGER,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      eventType TEXT NOT NULL DEFAULT 'EVENT',
      date TEXT NOT NULL,
      startTime TEXT,
      endTime TEXT,
      jobId TEXT REFERENCES jobs(id) ON DELETE SET NULL,
      teamId TEXT REFERENCES teams(id) ON DELETE SET NULL,
      maxSignups INTEGER,
      createdById TEXT REFERENCES users(id) ON DELETE SET NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_jobId ON calendar_events(jobId);

    CREATE TABLE IF NOT EXISTS event_signups (
      id TEXT PRIMARY KEY NOT NULL,
      eventId TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notes TEXT,
      signedUpAt TEXT NOT NULL,
      UNIQUE(eventId, userId)
    );
    CREATE INDEX IF NOT EXISTS idx_event_signups_userId ON event_signups(userId);
    CREATE INDEX IF NOT EXISTS idx_event_signups_eventId ON event_signups(eventId);

    CREATE TABLE IF NOT EXISTS volunteer_date_slots (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      startTime TEXT,
      endTime TEXT,
      jobIds TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(userId, date)
    );
    CREATE INDEX IF NOT EXISTS idx_vds_userId ON volunteer_date_slots(userId);
    CREATE INDEX IF NOT EXISTS idx_vds_date ON volunteer_date_slots(date);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      resource TEXT,
      resourceId TEXT,
      detail TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs(createdAt);

    CREATE TABLE IF NOT EXISTS file_assets (
      id TEXT PRIMARY KEY NOT NULL,
      filename TEXT NOT NULL,
      originalName TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      uploadedBy TEXT REFERENCES users(id) ON DELETE SET NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_policies (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      frequency TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_policy_roles (
      policyId TEXT NOT NULL REFERENCES training_policies(id) ON DELETE CASCADE,
      roleId   TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY(policyId, roleId)
    );

    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      updatedById TEXT REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      updatedById TEXT REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS team_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      teamId TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      taskType TEXT NOT NULL DEFAULT 'SITE',
      urgency TEXT NOT NULL DEFAULT 'ROUTINE',
      description TEXT,
      personnelRequired INTEGER,
      supervisorRequired INTEGER NOT NULL DEFAULT 0,
      equipment TEXT NOT NULL DEFAULT '[]',
      equipmentOther TEXT,
      consumables TEXT NOT NULL DEFAULT '[]',
      consumablesOther TEXT,
      safetyIssues TEXT NOT NULL DEFAULT '[]',
      safetyIssuesOther TEXT,
      equipmentLocations TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_tasks_teamId ON team_tasks(teamId);

    CREATE TABLE IF NOT EXISTS team_work_logs (
      id TEXT PRIMARY KEY NOT NULL,
      taskId TEXT NOT NULL REFERENCES team_tasks(id) ON DELETE CASCADE,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_work_logs_taskId ON team_work_logs(taskId);

    CREATE TABLE IF NOT EXISTS team_feedback (
      id TEXT PRIMARY KEY NOT NULL,
      teamId TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      feedback TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_team_feedback_teamId ON team_feedback(teamId);

    CREATE TABLE IF NOT EXISTS museum_status (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      createdById TEXT REFERENCES users(id) ON DELETE SET NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_museum_status_date ON museum_status(date);

    CREATE TABLE IF NOT EXISTS museum_opening_hours (
      id TEXT PRIMARY KEY NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      createdById TEXT REFERENCES users(id) ON DELETE SET NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_opening_hours_dates ON museum_opening_hours(startDate, endDate);

    CREATE TABLE IF NOT EXISTS bank_holidays (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      createdById TEXT REFERENCES users(id) ON DELETE SET NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bank_holidays_date ON bank_holidays(date);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      body TEXT NOT NULL,
      senderId TEXT REFERENCES users(id) ON DELETE SET NULL,
      teamId TEXT REFERENCES teams(id) ON DELETE CASCADE,
      recipientId TEXT REFERENCES users(id) ON DELETE CASCADE,
      isDeleted INTEGER NOT NULL DEFAULT 0,
      deletedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_senderId ON messages(senderId);
    CREATE INDEX IF NOT EXISTS idx_messages_teamId ON messages(teamId);
    CREATE INDEX IF NOT EXISTS idx_messages_recipientId ON messages(recipientId);
    CREATE INDEX IF NOT EXISTS idx_messages_createdAt ON messages(createdAt);

    CREATE TABLE IF NOT EXISTS message_reports (
      id TEXT PRIMARY KEY NOT NULL,
      messageId TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      reportedById TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      createdAt TEXT NOT NULL,
      UNIQUE(messageId, reportedById)
    );
    CREATE INDEX IF NOT EXISTS idx_message_reports_messageId ON message_reports(messageId);

    CREATE TABLE IF NOT EXISTS message_reads (
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      context TEXT NOT NULL,
      lastReadAt TEXT NOT NULL,
      PRIMARY KEY(userId, context)
    );
  `);

  // ─── Schema migrations ─────────────────────────────────────────────────────
  // Add sharepoint_folder_path to teams if the column doesn't yet exist (added in v0.11.0).
  const teamsInfo = db.prepare('PRAGMA table_info(teams)').all() as { name: string }[];
  if (!teamsInfo.some((c) => c.name === 'sharepoint_folder_path')) {
    db.exec('ALTER TABLE teams ADD COLUMN sharepoint_folder_path TEXT');
  }

  // Fix museum tables: createdById was incorrectly defined as NOT NULL with ON DELETE SET NULL,
  // causing SQLITE_CONSTRAINT_FOREIGNKEY when deleting a user who had created museum records.
  // Migrate each affected table by recreating it without the NOT NULL constraint.
  for (const table of ['museum_status', 'museum_opening_hours', 'bank_holidays'] as const) {
    const colInfo = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; notnull: number }[];
    const createdByCol = colInfo.find((c) => c.name === 'createdById');
    if (createdByCol && createdByCol.notnull === 1) {
      // createdById is still NOT NULL — rebuild the table to drop that constraint.
      db.exec(`
        ALTER TABLE ${table} RENAME TO ${table}_migration_backup;
      `);
      // Re-create with the correct (nullable) definition — pulled from the canonical CREATE above.
      if (table === 'museum_status') {
        db.exec(`
          CREATE TABLE museum_status (
            id TEXT PRIMARY KEY NOT NULL,
            date TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT,
            createdById TEXT REFERENCES users(id) ON DELETE SET NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_museum_status_date ON museum_status(date);
          INSERT INTO museum_status SELECT * FROM museum_status_migration_backup;
          DROP TABLE museum_status_migration_backup;
        `);
      } else if (table === 'museum_opening_hours') {
        db.exec(`
          CREATE TABLE museum_opening_hours (
            id TEXT PRIMARY KEY NOT NULL,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            createdById TEXT REFERENCES users(id) ON DELETE SET NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_opening_hours_dates ON museum_opening_hours(startDate, endDate);
          INSERT INTO museum_opening_hours SELECT * FROM museum_opening_hours_migration_backup;
          DROP TABLE museum_opening_hours_migration_backup;
        `);
      } else {
        db.exec(`
          CREATE TABLE bank_holidays (
            id TEXT PRIMARY KEY NOT NULL,
            date TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            createdById TEXT REFERENCES users(id) ON DELETE SET NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_bank_holidays_date ON bank_holidays(date);
          INSERT INTO bank_holidays SELECT * FROM bank_holidays_migration_backup;
          DROP TABLE bank_holidays_migration_backup;
        `);
      }
    }
  }
}

function openDb(): BetterSqlite3.Database {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const keySet = !!process.env.DB_ENCRYPTION_KEY;
  console.log(`[db] Opening database: ${dbPath} (encryption: ${keySet ? 'enabled' : 'disabled'})`);

  let db: BetterSqlite3.Database;
  try {
    db = new (Database as any)(dbPath);
  } catch (err) {
    console.error(`[db] Failed to open database file at: ${dbPath}`, err);
    throw err;
  }

  // Encryption — must be applied before any other operation.
  const rawKey = process.env.DB_ENCRYPTION_KEY;
  if (rawKey) {
    // Encode as hex so arbitrary byte sequences in the env var are safe.
    const hexKey = Buffer.from(rawKey, 'utf8').toString('hex');
    db.pragma(`key="x'${hexKey}'"`);
  }

  // Performance and reliability settings.
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    initSchema(db);
  } catch (err) {
    console.error(
      `[db] Failed to initialise database at: ${dbPath}. ` +
      `This usually means DB_ENCRYPTION_KEY is wrong, missing, or was changed after the database was created. ` +
      `Error:`, err,
    );
    throw err;
  }

  return db;
}

// Global singleton — safe across Next.js hot-module replacement cycles.
const g = globalThis as typeof globalThis & { _cnamDb?: BetterSqlite3.Database };

export function getDb(): BetterSqlite3.Database {
  if (g._cnamDb?.open) return g._cnamDb;
  const db = openDb();
  // Always cache the singleton.  In previous versions this was skipped in
  // production, which caused a new database connection to be opened on every
  // request — unnecessarily expensive and a source of confusion when debugging
  // path/key issues because each openDb() call emits a log line.
  g._cnamDb = db;
  return db;
}

// ─── Serialisation helpers ────────────────────────────────────────────────

/** Serialise a JS array to a JSON string for storage in a TEXT column. */
export function packJson(v: unknown[]): string {
  return JSON.stringify(v);
}

/** Deserialise a TEXT column value to a typed array, returning fallback on error. */
export function unpackArr<T = string>(raw: unknown, fallback: T[] = []): T[] {
  if (!raw) return fallback;
  if (Array.isArray(raw)) return raw as T[];
  try {
    const parsed = JSON.parse(raw as string);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

/** Deserialise a TEXT column value to a plain object, or null. */
export function unpackObj(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw as string);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Convert a Date to a 'YYYY-MM-DD' UTC string for date-only columns. */
export function packDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Parse a 'YYYY-MM-DD' string to a UTC midnight Date object. */
export function unpackDate(s: unknown): Date | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Convert a Date to an ISO 8601 string for datetime columns. */
export function packTs(d: Date): string {
  return d.toISOString();
}

/** Parse an ISO string to a Date object. */
export function unpackTs(s: unknown): Date {
  return new Date(String(s));
}

/** Convert SQLite INTEGER 0/1 to boolean. */
export function unpackBool(v: unknown): boolean {
  return v === 1 || v === true || v === '1';
}

/** Current ISO timestamp string. */
export function now(): string {
  return new Date().toISOString();
}
