'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export async function updateOwnProfile(name: string) {
  const actor = await requireAuth();

  const trimmedName = name.trim() || null;

  await prisma.user.update({
    where: { id: actor.id },
    data: { name: trimmedName },
  });

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

  await prisma.userPhone.create({
    data: {
      userId: actor.id,
      number: trimmedNumber,
      label: label.trim() || null,
    },
  });

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

  // Verify ownership before deleting
  const phone = await prisma.userPhone.findUnique({ where: { id: phoneId } });
  if (!phone || phone.userId !== actor.id) return;

  await prisma.userPhone.delete({ where: { id: phoneId } });

  await logAudit({
    userId: actor.id,
    action: 'PROFILE_PHONE_REMOVED',
    resource: 'User',
    resourceId: actor.id,
    detail: { phoneId },
  });

  revalidatePath('/profile');
}
