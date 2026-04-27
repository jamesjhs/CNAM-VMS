/**
 * Minimal NextAuth v5 database adapter backed by better-sqlite3-multiple-ciphers.
 *
 * This app uses JWT sessions with a Credentials-only provider so only
 * a handful of adapter methods are actually exercised by NextAuth internals.
 * All methods are still implemented correctly for completeness and future use.
 */

import type { Adapter, AdapterUser, AdapterSession, AdapterAccount, VerificationToken } from '@auth/core/adapters';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now, unpackTs } from './db';

/** Map a raw SQLite user row to an AdapterUser. */
function toAdapterUser(row: Record<string, unknown>): AdapterUser {
  return {
    id: row.id as string,
    email: row.email as string,
    emailVerified: row.emailVerified ? unpackTs(row.emailVerified) : null,
    name: (row.name as string | null) ?? null,
    image: (row.image as string | null) ?? null,
  };
}

export function createSqliteAdapter(): Adapter {
  return {
    // ── Users ──────────────────────────────────────────────────────────────

    async createUser(data: Omit<AdapterUser, 'id'>): Promise<AdapterUser> {
      const db = getDb();
      const id = createId();
      const ts = now();
      db.prepare(
        `INSERT INTO users (id, email, name, emailVerified, image, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        data.email.toLowerCase(),
        data.name ?? null,
        data.emailVerified?.toISOString() ?? null,
        data.image ?? null,
        ts,
        ts,
      );
      return { id, email: data.email, emailVerified: data.emailVerified ?? null, name: data.name ?? null, image: data.image ?? null };
    },

    async getUser(id: string): Promise<AdapterUser | null> {
      const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      return row ? toAdapterUser(row) : null;
    },

    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as Record<string, unknown> | undefined;
      return row ? toAdapterUser(row) : null;
    },

    async getUserByAccount({ provider, providerAccountId }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>): Promise<AdapterUser | null> {
      const row = getDb().prepare(
        `SELECT u.* FROM users u
         JOIN accounts a ON a.userId = u.id
         WHERE a.provider = ? AND a.providerAccountId = ?`,
      ).get(provider, providerAccountId) as Record<string, unknown> | undefined;
      return row ? toAdapterUser(row) : null;
    },

    async updateUser(data: Partial<AdapterUser> & Pick<AdapterUser, 'id'>): Promise<AdapterUser> {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(data.id) as Record<string, unknown>;
      db.prepare('UPDATE users SET name=?, emailVerified=?, image=?, updatedAt=? WHERE id=?').run(
        data.name ?? existing.name ?? null,
        data.emailVerified?.toISOString() ?? (existing.emailVerified as string | null) ?? null,
        data.image ?? existing.image ?? null,
        now(),
        data.id,
      );
      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(data.id) as Record<string, unknown>;
      return toAdapterUser(updated);
    },

    async deleteUser(userId: string): Promise<void> {
      getDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
    },

    // ── Accounts ───────────────────────────────────────────────────────────

    async linkAccount(data: AdapterAccount): Promise<AdapterAccount> {
      const db = getDb();
      const id = createId();
      db.prepare(
        `INSERT OR REPLACE INTO accounts
         (id, userId, type, provider, providerAccountId, refresh_token, access_token,
          expires_at, token_type, scope, id_token, session_state)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id,
        data.userId,
        data.type,
        data.provider,
        data.providerAccountId,
        data.refresh_token ?? null,
        data.access_token ?? null,
        data.expires_at ?? null,
        data.token_type ?? null,
        data.scope ?? null,
        data.id_token ?? null,
        data.session_state ?? null,
      );
      return data;
    },

    async unlinkAccount({ provider, providerAccountId }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>): Promise<void> {
      getDb().prepare('DELETE FROM accounts WHERE provider = ? AND providerAccountId = ?').run(provider, providerAccountId);
    },

    // ── Sessions ───────────────────────────────────────────────────────────

    async createSession(data: { sessionToken: string; userId: string; expires: Date }): Promise<AdapterSession> {
      const db = getDb();
      db.prepare('INSERT INTO sessions (id, sessionToken, userId, expires) VALUES (?,?,?,?)').run(
        createId(),
        data.sessionToken,
        data.userId,
        data.expires.toISOString(),
      );
      return data;
    },

    async getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const row = getDb().prepare(
        `SELECT s.sessionToken, s.userId, s.expires, u.id as uid, u.email, u.name, u.emailVerified, u.image
         FROM sessions s JOIN users u ON u.id = s.userId
         WHERE s.sessionToken = ?`,
      ).get(sessionToken) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        session: { sessionToken: row.sessionToken as string, userId: row.userId as string, expires: new Date(row.expires as string) },
        user: { id: row.uid as string, email: row.email as string, emailVerified: row.emailVerified ? new Date(row.emailVerified as string) : null, name: (row.name as string | null) ?? null, image: (row.image as string | null) ?? null },
      };
    },

    async updateSession(data: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>): Promise<AdapterSession | null> {
      const db = getDb();
      if (data.expires) {
        db.prepare('UPDATE sessions SET expires=? WHERE sessionToken=?').run(data.expires.toISOString(), data.sessionToken);
      }
      const row = db.prepare('SELECT * FROM sessions WHERE sessionToken=?').get(data.sessionToken) as Record<string, unknown> | undefined;
      if (!row) return null;
      return { sessionToken: row.sessionToken as string, userId: row.userId as string, expires: new Date(row.expires as string) };
    },

    async deleteSession(sessionToken: string): Promise<void> {
      getDb().prepare('DELETE FROM sessions WHERE sessionToken = ?').run(sessionToken);
    },

    // ── Verification tokens ────────────────────────────────────────────────

    async createVerificationToken(data: VerificationToken): Promise<VerificationToken> {
      getDb().prepare(
        'INSERT OR REPLACE INTO verification_tokens (identifier, token, expires) VALUES (?,?,?)',
      ).run(data.identifier, data.token, data.expires.toISOString());
      return data;
    },

    async useVerificationToken({ identifier, token }: { identifier: string; token: string }): Promise<VerificationToken | null> {
      const db = getDb();
      const row = db.prepare(
        'SELECT * FROM verification_tokens WHERE identifier=? AND token=?',
      ).get(identifier, token) as Record<string, unknown> | undefined;
      if (!row) return null;
      db.prepare('DELETE FROM verification_tokens WHERE identifier=? AND token=?').run(identifier, token);
      return { identifier: row.identifier as string, token: row.token as string, expires: new Date(row.expires as string) };
    },
  };
}
