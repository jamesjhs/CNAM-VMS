'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now } from '@/lib/db';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import type { UserStatus, UserAccountType } from '@/lib/db-types';

// ---------------------------------------------------------------------------
// User creation
// ---------------------------------------------------------------------------

export async function createUser(email: string, name: string, accountType: UserAccountType) {
  const actor = await requireCapability('admin:users.write');

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  if (!trimmedEmail) return;

  const db = getDb();
  const id = createId();
  const ts = now();
  db.prepare(
    'INSERT INTO users (id, email, name, accountType, status, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)',
  ).run(id, trimmedEmail, trimmedName || null, accountType, 'PENDING', ts, ts);

  await logAudit({
    userId: actor.id,
    action: 'USER_CREATED',
    resource: 'User',
    resourceId: id,
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

  const db = getDb();
  db.prepare('UPDATE users SET name=?, email=?, accountType=?, updatedAt=? WHERE id=?').run(trimmedName, trimmedEmail, accountType, now(), userId);

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

  const db = getDb();
  db.prepare('INSERT INTO user_phones (id, userId, number, label, createdAt) VALUES (?,?,?,?,?)').run(
    createId(), userId, trimmedNumber, label.trim() || null, now(),
  );

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

  const db = getDb();
  db.prepare('DELETE FROM user_phones WHERE id = ?').run(phoneId);

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
// User status actions
// ---------------------------------------------------------------------------

export async function updateUserStatus(userId: string, status: UserStatus) {
  const actor = await requireCapability('admin:users.write');

  const db = getDb();
  db.prepare('UPDATE users SET status=?, updatedAt=? WHERE id=?').run(status, now(), userId);

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

  const db = getDb();
  const target = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

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

  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO user_roles (userId, roleId, grantedAt, grantedBy) VALUES (?,?,?,?)').run(userId, roleId, now(), actor.id);

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

  const db = getDb();
  db.prepare('DELETE FROM user_roles WHERE userId = ? AND roleId = ?').run(userId, roleId);

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

  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO user_teams (userId, teamId, joinedAt) VALUES (?,?,?)').run(userId, teamId, now());

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

  const db = getDb();
  db.prepare('DELETE FROM user_teams WHERE userId = ? AND teamId = ?').run(userId, teamId);

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

  const db = getDb();
  const id = createId();
  const ts = now();
  db.prepare('INSERT INTO roles (id, name, description, createdAt, updatedAt) VALUES (?,?,?,?,?)').run(id, trimmedName, description.trim() || null, ts, ts);

  await logAudit({
    userId: actor.id,
    action: 'ROLE_CREATED',
    resource: 'Role',
    resourceId: id,
    detail: { name: trimmedName },
  });

  revalidatePath('/admin/roles');
}

export async function assignCapabilityToRole(roleId: string, capabilityId: string) {
  const actor = await requireCapability('admin:roles.write');

  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO role_capabilities (roleId, capabilityId) VALUES (?,?)').run(roleId, capabilityId);

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

  const db = getDb();
  db.prepare('DELETE FROM role_capabilities WHERE roleId = ? AND capabilityId = ?').run(roleId, capabilityId);

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

  const db = getDb();
  const id = createId();
  const ts = now();
  db.prepare('INSERT INTO teams (id, name, description, createdAt, updatedAt) VALUES (?,?,?,?,?)').run(id, trimmedName, description.trim() || null, ts, ts);

  await logAudit({
    userId: actor.id,
    action: 'TEAM_CREATED',
    resource: 'Team',
    resourceId: id,
    detail: { name: trimmedName },
  });

  revalidatePath('/admin/teams');
}

export async function updateTeam(teamId: string, name: string, description: string) {
  const actor = await requireCapability('admin:teams.write');

  const trimmedName = name.trim();
  if (!trimmedName) return;

  const db = getDb();
  db.prepare('UPDATE teams SET name=?, description=?, updatedAt=? WHERE id=?').run(trimmedName, description.trim() || null, now(), teamId);

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

  const db = getDb();
  db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);

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

  const db = getDb();
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
  if (!user?.email) return;

  const { randomBytes, createHash } = await import('crypto');
  const { sendPasswordResetEmail } = await import('@/lib/mail');

  // Use the configured public URL — never trust Host/X-Forwarded-Proto headers
  const baseUrl = (process.env.AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  const resetToken = randomBytes(32).toString('hex');
  const resetIdentifier = `pw-reset:${user.email}`;
  const { packTs } = await import('@/lib/db');

  db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(resetIdentifier);
  db.prepare('INSERT INTO verification_tokens (identifier, token, expires) VALUES (?,?,?)').run(
    resetIdentifier,
    // Hash the token before storage — raw token travels only in the email link
    createHash('sha256').update(resetToken).digest('hex'),
    packTs(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24 hours
  );

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

  const db = getDb();
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
  if (!user?.email) return;

  db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(`pw-fail:${user.email}`);

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

  const { packJson } = await import('@/lib/db');
  const db = getDb();
  const ts = now();
  const existing = db.prepare('SELECT id FROM volunteer_availability WHERE userId = ?').get(actor.id);
  if (existing) {
    db.prepare('UPDATE volunteer_availability SET activities=?, notes=?, updatedAt=? WHERE userId=?').run(
      packJson(activities), notes.trim() || null, ts, actor.id,
    );
  } else {
    db.prepare('INSERT INTO volunteer_availability (id, userId, activities, notes, updatedAt) VALUES (?,?,?,?,?)').run(
      createId(), actor.id, packJson(activities), notes.trim() || null, ts,
    );
  }

  revalidatePath('/volunteer/availability');
}
