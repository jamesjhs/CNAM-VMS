'use server';

import { redirect } from 'next/navigation';
import { getDb, now } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { verifyPassword, hashPassword } from '@/lib/password';
import { logAudit } from '@/lib/audit';

const MIN_PASSWORD_LENGTH = 8;

export async function changePassword(formData: FormData) {
  const actor = await requireAuth();

  const currentPassword = (formData.get('currentPassword') as string | null) ?? '';
  const newPassword = (formData.get('newPassword') as string | null) ?? '';
  const confirmPassword = (formData.get('confirmPassword') as string | null) ?? '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect('/auth/change-password?error=MissingFields');
  }

  if (newPassword !== confirmPassword) {
    redirect('/auth/change-password?error=PasswordMismatch');
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    redirect('/auth/change-password?error=TooShort');
  }

  const db = getDb();
  const user = db.prepare('SELECT passwordHash FROM users WHERE id = ?').get(actor.id) as { passwordHash: string | null } | undefined;

  if (!user?.passwordHash) {
    redirect('/auth/change-password?error=NoPassword');
  }

  const currentValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentValid) {
    redirect('/auth/change-password?error=WrongCurrentPassword');
  }

  const newHash = await hashPassword(newPassword);

  db.prepare('UPDATE users SET passwordHash=?, mustChangePassword=0, updatedAt=? WHERE id=?').run(newHash, now(), actor.id);

  await logAudit({
    userId: actor.id,
    action: 'PASSWORD_CHANGED',
    resource: 'User',
    resourceId: actor.id,
  });

  redirect('/dashboard');
}
