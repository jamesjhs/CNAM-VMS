import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { CAPABILITIES } from '@/lib/capabilities';
import type { UserStatus } from '@prisma/client';

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

        if (!tokenRecord || tokenRecord.token !== completionToken) return null;

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
        token.id = user.id;
        // Store keepSignedIn preference; cast to access the custom property
        const u = user as { id: string; keepSignedIn?: boolean };
        token.keepSignedIn = u.keepSignedIn ?? false;
        // Set JWT expiry based on preference:
        // - keepSignedIn: 7 days (matches session.maxAge)
        // - otherwise: 2 hours (requires re-sign-in after browser session / short inactivity)
        const maxAge = token.keepSignedIn ? 7 * 24 * 60 * 60 : 2 * 60 * 60;
        token.exp = Math.floor(Date.now() / 1000) + maxAge;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;

        // Attach status, mustChangePassword, and capabilities to session
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            status: true,
            mustChangePassword: true,
            userRoles: {
              include: {
                role: {
                  include: {
                    roleCapabilities: {
                      include: { capability: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (dbUser) {
          session.user.status = dbUser.status;
          session.user.mustChangePassword = dbUser.mustChangePassword;
          const caps = new Set<string>();
          for (const ur of dbUser.userRoles) {
            for (const rc of ur.role.roleCapabilities) {
              caps.add(rc.capability.key);
            }
          }
          session.user.capabilities = Array.from(caps);
        }
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
