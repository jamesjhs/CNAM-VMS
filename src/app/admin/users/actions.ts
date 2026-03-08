'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import type { UserStatus, UserAccountType } from '@prisma/client';

// ---------------------------------------------------------------------------
// User creation
// ---------------------------------------------------------------------------

export async function createUser(email: string, name: string, accountType: UserAccountType) {
  const actor = await requireCapability('admin:users.write');

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  if (!trimmedEmail) return;

  const user = await prisma.user.create({
    data: {
      email: trimmedEmail,
      name: trimmedName || null,
      accountType,
      status: 'PENDING',
    },
  });

  await logAudit({
    userId: actor.id,
    action: 'USER_CREATED',
    resource: 'User',
    resourceId: user.id,
    detail: { email: trimmedEmail, accountType },
  });

  revalidatePath('/admin/users');
}

// ---------------------------------------------------------------------------
// User profile actions
// ---------------------------------------------------------------------------

export async function updateUserProfile(userId: string, name: string, email: string, accountType: UserAccountType) {
  const actor = await requireCapability('admin:users.write');

  const trimmedName = name.trim() || null;
  const trimmedEmail = email.trim().toLowerCase();

  await prisma.user.update({
    where: { id: userId },
    data: { name: trimmedName, email: trimmedEmail, accountType },
  });

  await logAudit({
    userId: actor.id,
    action: 'USER_PROFILE_UPDATED',
    resource: 'User',
    resourceId: userId,
    detail: { name: trimmedName, email: trimmedEmail, accountType },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
}

// ---------------------------------------------------------------------------
// Phone number actions
// ---------------------------------------------------------------------------

export async function addUserPhone(userId: string, number: string, label: string) {
  const actor = await requireCapability('admin:users.write');

  const trimmedNumber = number.trim();
  if (!trimmedNumber) return;

  await prisma.userPhone.create({
    data: {
      userId,
      number: trimmedNumber,
      label: label.trim() || null,
    },
  });

  await logAudit({
    userId: actor.id,
    action: 'USER_PHONE_ADDED',
    resource: 'User',
    resourceId: userId,
    detail: { number: trimmedNumber, label: label.trim() || null },
  });

  revalidatePath(`/admin/users/${userId}`);
}

export async function removeUserPhone(userId: string, phoneId: string) {
  const actor = await requireCapability('admin:users.write');

  await prisma.userPhone.delete({ where: { id: phoneId } });

  await logAudit({
    userId: actor.id,
    action: 'USER_PHONE_REMOVED',
    resource: 'User',
    resourceId: userId,
    detail: { phoneId },
  });

  revalidatePath(`/admin/users/${userId}`);
}

// ---------------------------------------------------------------------------
// User actions
// ---------------------------------------------------------------------------

export async function updateUserStatus(userId: string, status: UserStatus) {
  const actor = await requireCapability('admin:users.write');

  await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  await logAudit({
    userId: actor.id,
    action: 'USER_STATUS_UPDATED',
    resource: 'User',
    resourceId: userId,
    detail: { status },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
}

export async function deleteUser(userId: string) {
  const actor = await requireCapability('admin:users.write');

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

  await prisma.user.delete({ where: { id: userId } });

  await logAudit({
    userId: actor.id,
    action: 'USER_DELETED',
    resource: 'User',
    resourceId: userId,
    detail: { email: target?.email },
  });

  revalidatePath('/admin/users');
  redirect('/admin/users');
}

// ---------------------------------------------------------------------------
// Role assignment actions
// ---------------------------------------------------------------------------

export async function assignRole(userId: string, roleId: string) {
  const actor = await requireCapability('admin:users.write');

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId, grantedBy: actor.id },
  });

  await logAudit({
    userId: actor.id,
    action: 'USER_ROLE_ASSIGNED',
    resource: 'User',
    resourceId: userId,
    detail: { roleId },
  });

  revalidatePath(`/admin/users/${userId}`);
}

export async function removeRole(userId: string, roleId: string) {
  const actor = await requireCapability('admin:users.write');

  await prisma.userRole.deleteMany({ where: { userId, roleId } });

  await logAudit({
    userId: actor.id,
    action: 'USER_ROLE_REMOVED',
    resource: 'User',
    resourceId: userId,
    detail: { roleId },
  });

  revalidatePath(`/admin/users/${userId}`);
}

// ---------------------------------------------------------------------------
// Team assignment actions
// ---------------------------------------------------------------------------

export async function assignTeam(userId: string, teamId: string) {
  const actor = await requireCapability('admin:users.write');

  await prisma.userTeam.upsert({
    where: { userId_teamId: { userId, teamId } },
    update: {},
    create: { userId, teamId },
  });

  await logAudit({
    userId: actor.id,
    action: 'USER_TEAM_ASSIGNED',
    resource: 'User',
    resourceId: userId,
    detail: { teamId },
  });

  revalidatePath(`/admin/users/${userId}`);
}

export async function removeTeam(userId: string, teamId: string) {
  const actor = await requireCapability('admin:users.write');

  await prisma.userTeam.deleteMany({ where: { userId, teamId } });

  await logAudit({
    userId: actor.id,
    action: 'USER_TEAM_REMOVED',
    resource: 'User',
    resourceId: userId,
    detail: { teamId },
  });

  revalidatePath(`/admin/users/${userId}`);
}

// ---------------------------------------------------------------------------
// Role management actions
// ---------------------------------------------------------------------------

export async function createRole(name: string, description: string) {
  const actor = await requireCapability('admin:roles.write');

  const trimmedName = name.trim();
  if (!trimmedName) return;

  const role = await prisma.role.create({
    data: { name: trimmedName, description: description.trim() || null },
  });

  await logAudit({
    userId: actor.id,
    action: 'ROLE_CREATED',
    resource: 'Role',
    resourceId: role.id,
    detail: { name: trimmedName },
  });

  revalidatePath('/admin/roles');
}

export async function assignCapabilityToRole(roleId: string, capabilityId: string) {
  const actor = await requireCapability('admin:roles.write');

  await prisma.roleCapability.upsert({
    where: { roleId_capabilityId: { roleId, capabilityId } },
    update: {},
    create: { roleId, capabilityId },
  });

  await logAudit({
    userId: actor.id,
    action: 'ROLE_CAPABILITY_ASSIGNED',
    resource: 'Role',
    resourceId: roleId,
    detail: { capabilityId },
  });

  revalidatePath('/admin/roles');
}

export async function removeCapabilityFromRole(roleId: string, capabilityId: string) {
  const actor = await requireCapability('admin:roles.write');

  await prisma.roleCapability.deleteMany({ where: { roleId, capabilityId } });

  await logAudit({
    userId: actor.id,
    action: 'ROLE_CAPABILITY_REMOVED',
    resource: 'Role',
    resourceId: roleId,
    detail: { capabilityId },
  });

  revalidatePath('/admin/roles');
}

// ---------------------------------------------------------------------------
// Team management actions
// ---------------------------------------------------------------------------

export async function createTeam(name: string, description: string) {
  const actor = await requireCapability('admin:teams.write');

  const trimmedName = name.trim();
  if (!trimmedName) return;

  const team = await prisma.team.create({
    data: { name: trimmedName, description: description.trim() || null },
  });

  await logAudit({
    userId: actor.id,
    action: 'TEAM_CREATED',
    resource: 'Team',
    resourceId: team.id,
    detail: { name: trimmedName },
  });

  revalidatePath('/admin/teams');
}

export async function updateTeam(teamId: string, name: string, description: string) {
  const actor = await requireCapability('admin:teams.write');

  const trimmedName = name.trim();
  if (!trimmedName) return;

  await prisma.team.update({
    where: { id: teamId },
    data: { name: trimmedName, description: description.trim() || null },
  });

  await logAudit({
    userId: actor.id,
    action: 'TEAM_UPDATED',
    resource: 'Team',
    resourceId: teamId,
    detail: { name: trimmedName },
  });

  revalidatePath('/admin/teams');
}

export async function deleteTeam(teamId: string) {
  const actor = await requireCapability('admin:teams.write');

  await prisma.team.delete({ where: { id: teamId } });

  await logAudit({
    userId: actor.id,
    action: 'TEAM_DELETED',
    resource: 'Team',
    resourceId: teamId,
  });

  revalidatePath('/admin/teams');
}

// ---------------------------------------------------------------------------
// Password management (admin)
// ---------------------------------------------------------------------------

/**
 * Admin sends a password reset email to the user.
 * The user follows the link to set their own password.
 */
export async function adminSendPasswordReset(userId: string) {
  const actor = await requireCapability('admin:users.write');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return;

  const { randomBytes } = await import('crypto');
  const { sendPasswordResetEmail } = await import('@/lib/mail');
  const { headers } = await import('next/headers');

  const headerStore = await headers();
  const host = headerStore.get('host') ?? 'localhost';
  const proto = headerStore.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  const resetToken = randomBytes(32).toString('hex');
  const resetIdentifier = `pw-reset:${user.email}`;

  await prisma.verificationToken.deleteMany({ where: { identifier: resetIdentifier } });
  await prisma.verificationToken.create({
    data: {
      identifier: resetIdentifier,
      token: resetToken,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;
  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch {
    // Email failure — token still created; admin can retry
  }

  await logAudit({
    userId: actor.id,
    action: 'ADMIN_PASSWORD_RESET_SENT',
    resource: 'User',
    resourceId: userId,
    detail: { email: user.email },
  });

  revalidatePath(`/admin/users/${userId}`);
}

/**
 * Admin clears the failed-login lockout for a user so they can try again immediately.
 */
export async function resetUserLockout(userId: string) {
  const actor = await requireCapability('admin:users.write');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return;

  await prisma.verificationToken.deleteMany({
    where: { identifier: `pw-fail:${user.email}` },
  });

  await logAudit({
    userId: actor.id,
    action: 'USER_LOCKOUT_CLEARED',
    resource: 'User',
    resourceId: userId,
    detail: { email: user.email },
  });

  revalidatePath(`/admin/users/${userId}`);
}

// ---------------------------------------------------------------------------
// Volunteer availability actions
// ---------------------------------------------------------------------------

export async function updateVolunteerAvailability(activities: string[], notes: string) {
  const { requireAuth } = await import('@/lib/auth-helpers');
  const actor = await requireAuth();

  await prisma.volunteerAvailability.upsert({
    where: { userId: actor.id },
    update: { activities, notes: notes.trim() || null },
    create: { userId: actor.id, activities, notes: notes.trim() || null },
  });

  revalidatePath('/volunteer/availability');
}
