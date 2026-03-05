import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Email from 'next-auth/providers/email';
import { prisma } from '@/lib/prisma';
import type { UserStatus } from '@prisma/client';

/**
 * Promote a user to ACTIVE status and assign them the Root role.
 * The Root role is created if it does not already exist.
 * This is called automatically for the ROOT_USER_EMAIL on sign-in.
 */
async function promoteToRootUser(userId: string): Promise<void> {
  // Ensure the Root role exists
  const rootRole = await prisma.role.upsert({
    where: { name: 'Root' },
    update: {},
    create: {
      name: 'Root',
      description: 'Superadmin with all capabilities',
      isSystem: true,
    },
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
  session: { strategy: 'jwt' },
  providers: [
    Email({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM ?? 'noreply@example.com',
      normalizeIdentifier(identifier: string): string {
        // Normalize email to lowercase
        return identifier.toLowerCase().trim();
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const email = user.email.toLowerCase().trim();

      const dbUser = await prisma.user.findUnique({
        where: { email },
      });

      // Allow first-time sign-in to create PENDING user (handled via createUser event)
      if (!dbUser) {
        return true;
      }

      // Block suspended users
      const status: UserStatus = dbUser.status;
      if (status === 'SUSPENDED') {
        return '/auth/error?error=AccountSuspended';
      }

      // Auto-promote the configured root user if they are still PENDING
      const rootEmail = getRootEmail();
      if (rootEmail && email === rootEmail && dbUser.status !== 'ACTIVE') {
        await promoteToRootUser(dbUser.id);
      }

      return true;
    },
    async jwt({ token, user }) {
      // On initial sign-in, persist the user ID into the JWT
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;

        // Attach status and capabilities to session
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            status: true,
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
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;

      // Log new user creation
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_CREATED',
          resource: 'User',
          resourceId: user.id,
          detail: { email: user.email },
        },
      });

      // Auto-promote the root user on their very first sign-in.
      // PrismaAdapter creates the user (status=PENDING) before this event fires,
      // so we can safely promote them here.
      const rootEmail = getRootEmail();
      if (rootEmail && user.email?.toLowerCase().trim() === rootEmail) {
        await promoteToRootUser(user.id);
      }
    },
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
