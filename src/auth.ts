import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createHash, timingSafeEqual } from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now, unpackBool, packTs } from '@/lib/db';
import { CAPABILITIES } from '@/lib/capabilities';
import { createSqliteAdapter } from '@/lib/auth-adapter';
import type { UserStatus } from '@/lib/db-types';

// How long (in seconds) capability/status data cached in the JWT remains
// fresh before being re-read from the database.  A short TTL (1 minute)
// means capability changes propagate quickly without a DB hit on every
// request.
const CAPABILITIES_CACHE_TTL = 60; // 1 minute

/**
 * Fetch the current user's status, mustChangePassword flag, and capability
 * keys from the database.  The result is stored in the JWT so subsequent
 * requests can read it without hitting the DB again until the TTL expires.
 */
async function fetchUserClaims(userId: string): Promise<{
  status: string;
  mustChangePassword: boolean;
  capabilities: string[];
} | null> {
  const db = getDb();
  type UserRow = { status: string; mustChangePassword: number };
  const dbUser = db.prepare('SELECT status, mustChangePassword FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!dbUser) return null;

  const capRows = db.prepare(
    `SELECT DISTINCT c.key FROM user_roles ur
     JOIN role_capabilities rc ON rc.roleId = ur.roleId
     JOIN capabilities c ON c.id = rc.capabilityId
     WHERE ur.userId = ?`,
  ).all(userId) as { key: string }[];

  return {
    status: dbUser.status,
    mustChangePassword: unpackBool(dbUser.mustChangePassword),
    capabilities: capRows.map((r) => r.key),
  };
}

/**
 * Promote a user to ACTIVE status and assign them the Root role.
 * The Root role is created if it does not already exist, and all capabilities
 * are upserted and assigned to it so the admin can access protected pages
 * without requiring a separate seed step.
 * Only promotes if the user is not already ACTIVE, ensuring one-time promotion.
 */
function promoteToRootUser(userId: string): void {
  const db = getDb();
  
  // Check if user is already ACTIVE (already promoted)
  type UserRow = { status: string };
  const user = db.prepare('SELECT status FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (user?.status === 'ACTIVE') return; // Already promoted, skip
  
  const ts = now();

  // Ensure every capability exists
  for (const cap of CAPABILITIES) {
    const existing = db.prepare('SELECT id FROM capabilities WHERE key = ?').get(cap.key) as { id: string } | undefined;
    if (!existing) {
      db.prepare('INSERT INTO capabilities (id, key, description, createdAt) VALUES (?,?,?,?)').run(createId(), cap.key, cap.description, ts);
    } else {
      db.prepare('UPDATE capabilities SET description = ? WHERE key = ?').run(cap.description, cap.key);
    }
  }

  // Ensure the Root role exists
  let rootRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('Root') as { id: string } | undefined;
  if (!rootRole) {
    const id = createId();
    db.prepare('INSERT INTO roles (id, name, description, isSystem, createdAt, updatedAt) VALUES (?,?,?,1,?,?)').run(
      id, 'Root', 'Superadmin with all capabilities', ts, ts,
    );
    rootRole = { id };
  } else {
    db.prepare('UPDATE roles SET description=?, isSystem=1, updatedAt=? WHERE id=?').run('Superadmin with all capabilities', ts, rootRole.id);
  }

  // Assign all capabilities to the Root role
  const allCaps = db.prepare('SELECT id FROM capabilities').all() as { id: string }[];
  for (const cap of allCaps) {
    db.prepare('INSERT OR IGNORE INTO role_capabilities (roleId, capabilityId) VALUES (?,?)').run(rootRole.id, cap.id);
  }

  // Promote user to ACTIVE and assign Root role (one-time operation)
  db.prepare('UPDATE users SET status=?, updatedAt=? WHERE id=?').run('ACTIVE', ts, userId);
  db.prepare('INSERT OR IGNORE INTO user_roles (userId, roleId, grantedAt) VALUES (?,?,?)').run(userId, rootRole.id, ts);
}

/** Return the normalised ROOT_USER_EMAIL, or undefined if not configured. */
function getRootEmail(): string | undefined {
  return process.env.ROOT_USER_EMAIL?.toLowerCase().trim();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createSqliteAdapter(),
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 }, // max 7 days
  providers: [
    /**
     * Credentials provider — used for the two-step auth flow:
     *  1. submitPassword server action validates email + password and sends OTP
     *  2. submitOtp server action verifies OTP and creates a one-time completion token
     *  3. This provider validates that completion token and creates the JWT session
     */
    Credentials({
      credentials: {
        userId: { type: 'text' },
        completionToken: { type: 'text' },
        keepSignedIn: { type: 'text' },
      },
      async authorize(credentials) {
        const userId = credentials?.userId as string | undefined;
        const completionToken = credentials?.completionToken as string | undefined;
        const keepSignedIn = credentials?.keepSignedIn === '1';

        console.log(`[auth] Credentials.authorize: validating completion token for user ${userId}...`);
        if (!userId || !completionToken) {
          console.warn('[auth] Credentials.authorize: missing userId or completionToken');
          return null;
        }

        const db = getDb();
        const identifier = `auth:complete:${userId}`;
        const cutoff = packTs(new Date());

        // Find the one-time completion token (valid for 2 minutes)
        const tokenRecord = db.prepare(
          'SELECT * FROM verification_tokens WHERE identifier = ? AND expires > ?',
        ).get(identifier, cutoff) as { identifier: string; token: string; expires: string } | undefined;

        if (!tokenRecord) {
          console.warn(`[auth] Credentials.authorize: no completion token found for user ${userId} — may have expired`);
        }

        // Hash the incoming token and compare timing-safely against the stored hash
        const incomingHash = createHash('sha256').update(completionToken).digest('hex');
        const storedHash = tokenRecord?.token ?? '';
        const tokenValid =
          storedHash.length > 0 &&
          timingSafeEqual(Buffer.from(incomingHash, 'hex'), Buffer.from(storedHash, 'hex'));

        if (!tokenRecord || !tokenValid) {
          console.warn(`[auth] Credentials.authorize: completion token INVALID for user ${userId}`);
          return null;
        }

        console.log(`[auth] Credentials.authorize: completion token VALID, deleting one-time token...`);
        // Delete immediately — single-use token
        db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(identifier);

        // Fetch the user
        type UserRow = { id: string; email: string; name: string | null; image: string | null; status: string };
        const user = db.prepare('SELECT id, email, name, image, status FROM users WHERE id = ?').get(userId) as UserRow | undefined;
        if (!user) {
          console.warn(`[auth] Credentials.authorize: user ${userId} not found in database`);
          return null;
        }
        if (user.status === 'SUSPENDED') {
          console.warn(`[auth] Credentials.authorize: user ${userId} is SUSPENDED`);
          return null;
        }

        console.log(`[auth] Credentials.authorize: SUCCESS — user ${user.email} authorized, creating JWT session...`);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          keepSignedIn,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Only run for credentials provider (other providers skip this)
      if (account?.provider !== 'credentials') return true;
      if (!user.email) {
        console.warn('[auth] signIn callback: no email in user object');
        return false;
      }

      console.log(`[auth] signIn callback: processing sign-in for ${user.email}...`);
      const db = getDb();
      const email = user.email.toLowerCase().trim();
      type UserRow = { id: string; status: string };
      const dbUser = db.prepare('SELECT id, status FROM users WHERE email = ?').get(email) as UserRow | undefined;
      if (!dbUser) {
        console.warn(`[auth] signIn callback: user ${email} not found in database`);
        return false;
      }

      const status: UserStatus = dbUser.status as UserStatus;
      if (status === 'SUSPENDED') {
        console.warn(`[auth] signIn callback: user ${email} is SUSPENDED`);
        return '/auth/error?error=AccountSuspended';
      }

      // Ensure the root user always has the Root role and all capabilities assigned.
      const rootEmail = getRootEmail();
      if (rootEmail && email === rootEmail) {
        console.log(`[auth] signIn callback: promoting root user ${email} to Root role...`);
        promoteToRootUser(dbUser.id);
      }

      console.log(`[auth] signIn callback: sign-in authorized for ${email}`);
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        // Initial sign-in — populate the token with the user's id and
        // eagerly load claims so the first request has them immediately.
        token.id = user.id;
        // Store keepSignedIn preference; cast to access the custom property
        const u = user as { id: string; keepSignedIn?: boolean };
        token.keepSignedIn = u.keepSignedIn ?? false;
        // Set JWT expiry based on preference:
        // - keepSignedIn: 7 days (matches session.maxAge)
        // - otherwise: 2 hours (requires re-sign-in after browser session / short inactivity)
        const maxAge = token.keepSignedIn ? 7 * 24 * 60 * 60 : 2 * 60 * 60;
        token.exp = Math.floor(Date.now() / 1000) + maxAge;

        // Eagerly populate claims so the very first session() call is free.
        const claims = await fetchUserClaims(user.id);
        if (claims) {
          token.status = claims.status;
          token.mustChangePassword = claims.mustChangePassword;
          token.capabilities = claims.capabilities;
          token.capabilitiesAt = Math.floor(Date.now() / 1000);
        }
        return token;
      }

      // Subsequent calls — refresh claims from DB if the cache has expired.
      const nowSec = Math.floor(Date.now() / 1000);
      const lastRefresh = token.capabilitiesAt ?? 0;
      if (token.id && nowSec - lastRefresh > CAPABILITIES_CACHE_TTL) {
        const claims = await fetchUserClaims(token.id);
        if (claims) {
          token.status = claims.status;
          token.mustChangePassword = claims.mustChangePassword;
          token.capabilities = claims.capabilities;
          token.capabilitiesAt = nowSec;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        // Read cached claims from the JWT — no DB round-trip required.
        const pendingStatus: UserStatus = 'PENDING';
        session.user.status = (token.status as string) ?? pendingStatus;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
        session.user.capabilities = token.capabilities ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  events: {
    async signIn({ user }) {
      if (user.id) {
        const db = getDb();
        db.prepare(
          `INSERT INTO audit_logs (id, userId, action, resource, resourceId, createdAt)
           VALUES (?,?,?,?,?,?)`,
        ).run(createId(), user.id, 'USER_SIGNIN', 'User', user.id, now());
      }
    },
  },
});
