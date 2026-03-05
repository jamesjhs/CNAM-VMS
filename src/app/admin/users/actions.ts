'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import type { UserStatus } from '@prisma/client';

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
