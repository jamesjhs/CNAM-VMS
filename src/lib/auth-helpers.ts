import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  status: string;
  capabilities: string[];
};

/**
 * Get the current authenticated session user.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

/**
 * Require authentication. Redirects to sign-in if not authenticated.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  return user;
}

/**
 * Require a specific capability. Redirects to /unauthorized if missing.
 */
export async function requireCapability(capability: string): Promise<SessionUser> {
  const user = await requireAuth();
  if (!hasCapability(user, capability)) {
    redirect('/unauthorized');
  }
  return user;
}

/**
 * Check if a user has a specific capability.
 */
export function hasCapability(user: SessionUser | null, capability: string): boolean {
  if (!user) return false;
  return user.capabilities.includes(capability);
}

/**
 * Check if a user has any of the given capabilities.
 */
export function hasAnyCapability(user: SessionUser | null, capabilities: string[]): boolean {
  if (!user) return false;
  return capabilities.some((cap) => user.capabilities.includes(cap));
}

/**
 * Require the user to be ACTIVE. Redirect to /auth/error if not.
 */
export async function requireActiveUser(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.status !== 'ACTIVE') {
    redirect('/auth/error?error=AccountPending');
  }
  return user;
}
