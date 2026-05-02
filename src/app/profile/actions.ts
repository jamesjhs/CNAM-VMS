'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import { verifyPassword, hashPassword } from '@/lib/password';

const MIN_PASSWORD_LENGTH = 8;
const PHONE_REGEX = /^[\d\s\-\+\(\)]{7,20}$/;

function isValidPhoneNumber(phone: string): boolean {
  return PHONE_REGEX.test(phone.trim());
}

export async function updateOwnProfile(name: string) {
  const actor = await requireAuth();

  const trimmedName = name.trim() || null;
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

  const db = getDb();
  db.prepare('INSERT INTO user_phones (id, userId, number, label, createdAt) VALUES (?,?,?,?,?)').run(
    createId(), actor.id, trimmedNumber, label.trim() || null, now(),
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

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    redirect('/profile?error=TooShort');
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
