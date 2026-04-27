'use server';

import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

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
  if (!trimmedNumber) return;

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
