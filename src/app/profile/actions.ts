'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import { verifyPassword, hashPassword } from '@/lib/password';
import { validatePasswordComplexity } from '@/lib/password-validation';
import { signOut } from '@/auth';

const PHONE_REGEX = /^[\d\s\-\+\(\)]{7,20}$/;
const MAX_LABEL_LENGTH = 50;
const MAX_NAME_LENGTH = 150;

function isValidPhoneNumber(phone: string): boolean {
  return PHONE_REGEX.test(phone.trim());
}

export async function updateOwnProfile(name: string) {
  const actor = await requireAuth();

  const trimmedName = (name.trim() || null);
  if (trimmedName && trimmedName.length > MAX_NAME_LENGTH) {
    redirect('/profile?error=NameTooLong');
  }
  const db = getDb();
  db.prepare('UPDATE users SET name=?, updatedAt=? WHERE id=?').run(trimmedName, now(), actor.id);

  await logAudit({
    userId: actor.id,
    action: 'PROFILE_UPDATED',
    resource: 'User',
    resourceId: actor.id,
    detail: { name: trimmedName },
  });

  revalidatePath('/profile');
}

export async function addOwnPhone(number: string, label: string) {
  const actor = await requireAuth();

  const trimmedNumber = number.trim();
  if (!trimmedNumber) return redirect('/profile?error=EmptyPhone');

  // Validate phone number format
  if (!isValidPhoneNumber(trimmedNumber)) {
    return redirect('/profile?error=InvalidPhone');
  }

  // Validate label length
  const trimmedLabel = label.trim();
  if (trimmedLabel && trimmedLabel.length > MAX_LABEL_LENGTH) {
    return redirect('/profile?error=LabelTooLong');
  }

  const db = getDb();
  db.prepare('INSERT INTO user_phones (id, userId, number, label, createdAt) VALUES (?,?,?,?,?)').run(
    createId(), actor.id, trimmedNumber, trimmedLabel || null, now(),
  );

  await logAudit({
    userId: actor.id,
    action: 'PROFILE_PHONE_ADDED',
    resource: 'User',
    resourceId: actor.id,
    detail: { number: trimmedNumber },
  });

  revalidatePath('/profile');
}

export async function removeOwnPhone(phoneId: string) {
  const actor = await requireAuth();

  const db = getDb();
  // Verify ownership before deleting
  const phone = db.prepare('SELECT userId FROM user_phones WHERE id = ?').get(phoneId) as { userId: string } | undefined;
  if (!phone || phone.userId !== actor.id) return;

  db.prepare('DELETE FROM user_phones WHERE id = ?').run(phoneId);

  await logAudit({
    userId: actor.id,
    action: 'PROFILE_PHONE_REMOVED',
    resource: 'User',
    resourceId: actor.id,
    detail: { phoneId },
  });

  revalidatePath('/profile');
}

export async function changePasswordFromProfile(formData: FormData) {
  const actor = await requireAuth();

  const currentPassword = (formData.get('currentPassword') as string | null) ?? '';
  const newPassword = (formData.get('newPassword') as string | null) ?? '';
  const confirmPassword = (formData.get('confirmPassword') as string | null) ?? '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect('/profile?error=MissingFields');
  }

  if (newPassword !== confirmPassword) {
    redirect('/profile?error=PasswordMismatch');
  }

  const complexityError = validatePasswordComplexity(newPassword);
  if (complexityError) {
    redirect(`/profile?error=${complexityError}`);
  }

  const db = getDb();
  const user = db.prepare('SELECT passwordHash FROM users WHERE id = ?').get(actor.id) as { passwordHash: string | null } | undefined;

  if (!user?.passwordHash) {
    redirect('/profile?error=NoPassword');
  }

  const currentValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentValid) {
    redirect('/profile?error=WrongCurrentPassword');
  }

  const newHash = await hashPassword(newPassword);

  db.prepare('UPDATE users SET passwordHash=?, mustChangePassword=0, updatedAt=? WHERE id=?').run(newHash, now(), actor.id);

  await logAudit({
    userId: actor.id,
    action: 'PASSWORD_CHANGED',
    resource: 'User',
    resourceId: actor.id,
  });

  redirect('/profile?success=PasswordChanged');
}

/**
 * Allow a user to permanently delete their own account.
 * Requires the user's current password as confirmation.
 * On success the session is invalidated and the user is redirected to the sign-in page.
 */
export async function deleteOwnAccount(formData: FormData) {
  const actor = await requireAuth();

  const password = (formData.get('password') as string | null) ?? '';
  if (!password) {
    redirect('/profile?error=PasswordRequired');
  }

  const db = getDb();
  const user = db.prepare('SELECT passwordHash, email FROM users WHERE id = ?').get(actor.id) as { passwordHash: string | null; email: string } | undefined;

  if (!user?.passwordHash) {
    redirect('/profile?error=NoPassword');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    redirect('/profile?error=WrongCurrentPassword');
  }

  await logAudit({
    userId: actor.id,
    action: 'USER_SELF_DELETED',
    resource: 'User',
    resourceId: actor.id,
    detail: { email: user.email },
  });

  // Delete the account — ON DELETE CASCADE removes all related rows
  db.prepare('DELETE FROM users WHERE id = ?').run(actor.id);

  // Sign out and redirect to sign-in (the JWT will be invalidated by the session cookie deletion)
  await signOut({ redirectTo: '/auth/signin?deleted=1' });
}
