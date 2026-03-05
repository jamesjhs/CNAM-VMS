import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Email from 'next-auth/providers/email';
import { prisma } from '@/lib/prisma';
import type { UserStatus } from '@prisma/client';

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

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase().trim() },
      });

      // Allow first-time sign-in to create PENDING user (they'll need approval)
      if (!dbUser) {
        return true;
      }

      // Block suspended users
      const status: UserStatus = dbUser.status;
      if (status === 'SUSPENDED') {
        return '/auth/error?error=AccountSuspended';
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
      // Log new user creation
      if (user.id) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'USER_CREATED',
            resource: 'User',
            resourceId: user.id,
            detail: { email: user.email },
          },
        });
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
