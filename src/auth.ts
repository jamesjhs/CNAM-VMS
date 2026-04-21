import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import { createHash, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { CAPABILITIES } from '@/lib/capabilities';
import type { UserStatus } from '@prisma/client';

// How long (in seconds) capability/status data cached in the JWT remains
// fresh before being re-read from the database.  A short TTL (5 minutes)
// means capability changes propagate quickly without a DB hit on every
// request.
const CAPABILITIES_CACHE_TTL = 5 * 60; // 5 minutes

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
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      mustChangePassword: true,
      userRoles: {
        select: {
          role: {
            select: {
              roleCapabilities: {
                select: { capability: { select: { key: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!dbUser) return null;

  const caps = new Set<string>();
  for (const ur of dbUser.userRoles) {
    for (const rc of ur.role.roleCapabilities) {
      caps.add(rc.capability.key);
    }
  }

  return {
    status: dbUser.status,
    mustChangePassword: dbUser.mustChangePassword,
    capabilities: Array.from(caps),
  };
}

/**
 * Promote a user to ACTIVE status and assign them the Root role.
 * The Root role is created if it does not already exist, and all capabilities
 * are upserted and assigned to it so the admin can access protected pages
 * without requiring a separate seed step.
 * This is called automatically for the ROOT_USER_EMAIL on sign-in.
 */
async function promoteToRootUser(userId: string): Promise<void> {
  // Ensure every capability exists in the database (run concurrently)
  await Promise.all(
    CAPABILITIES.map((cap) =>
      prisma.capability.upsert({
        where: { key: cap.key },
        update: { description: cap.description },
        create: { key: cap.key, description: cap.description },
      }),
    ),
  );

  // Ensure the Root role exists
  const rootRole = await prisma.role.upsert({
    where: { name: 'Root' },
    update: { description: 'Superadmin with all capabilities', isSystem: true },
    create: {
      name: 'Root',
      description: 'Superadmin with all capabilities',
      isSystem: true,
    },
  });

  // Assign all capabilities to the Root role (skip any that already exist)
  const allCapabilities = await prisma.capability.findMany();
  await prisma.roleCapability.createMany({
    data: allCapabilities.map((cap) => ({ roleId: rootRole.id, capabilityId: cap.id })),
    skipDuplicates: true,
  });

  // Promote user to ACTIVE and assign Root role atomically
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    }),
    prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: rootRole.id } },
      update: {},
      create: { userId, roleId: rootRole.id },
    }),
  ]);
}

/** Return the normalised ROOT_USER_EMAIL, or undefined if not configured. */
function getRootEmail(): string | undefined {
  return process.env.ROOT_USER_EMAIL?.toLowerCase().trim();
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({
  adapter: PrismaAdapter(prisma),
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

        if (!userId || !completionToken) return null;

        const identifier = `auth:complete:${userId}`;

        // Find the one-time completion token (valid for 2 minutes)
        const tokenRecord = await prisma.verificationToken.findFirst({
          where: { identifier, expires: { gt: new Date() } },
        });

        // Hash the incoming token and compare timing-safely against the stored hash
        const incomingHash = createHash('sha256').update(completionToken).digest('hex');
        const storedHash = tokenRecord?.token ?? '';
        const tokenValid =
          storedHash.length > 0 &&
          timingSafeEqual(Buffer.from(incomingHash, 'hex'), Buffer.from(storedHash, 'hex'));

        if (!tokenRecord || !tokenValid) return null;

        // Delete immediately — single-use token
        await prisma.verificationToken.deleteMany({ where: { identifier } });

        // Fetch the user
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return null;
        if (user.status === 'SUSPENDED') return null;

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
      if (!user.email) return false;

      const email = user.email.toLowerCase().trim();
      const dbUser = await prisma.user.findUnique({ where: { email } });
      if (!dbUser) return false;

      const status: UserStatus = dbUser.status;
      if (status === 'SUSPENDED') return '/auth/error?error=AccountSuspended';

      // Ensure the root user always has the Root role and all capabilities assigned.
      const rootEmail = getRootEmail();
      if (rootEmail && email === rootEmail) {
        await promoteToRootUser(dbUser.id);
      }

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
      const now = Math.floor(Date.now() / 1000);
      const lastRefresh = token.capabilitiesAt ?? 0;
      if (token.id && now - lastRefresh > CAPABILITIES_CACHE_TTL) {
        const claims = await fetchUserClaims(token.id);
        if (claims) {
          token.status = claims.status;
          token.mustChangePassword = claims.mustChangePassword;
          token.capabilities = claims.capabilities;
          token.capabilitiesAt = now;
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
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'USER_SIGNIN',
            resource: 'User',
            resourceId: user.id,
          },
        });
      }
    },
  },
}));
