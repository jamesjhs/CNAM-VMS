'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export async function createAnnouncement(title: string, body: string, pinned: boolean) {
  const actor = await requireCapability('admin:announcements.write');

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (!trimmedTitle || !trimmedBody) return;

  const announcement = await prisma.announcement.create({
    data: {
      title: trimmedTitle,
      body: trimmedBody,
      pinned,
      authorId: actor.id,
    },
  });

  await logAudit({
    userId: actor.id,
    action: 'ANNOUNCEMENT_CREATED',
    resource: 'Announcement',
    resourceId: announcement.id,
    detail: { title: trimmedTitle, pinned },
  });

  revalidatePath('/admin/announcements');
  revalidatePath('/announcements');
}

export async function deleteAnnouncement(id: string) {
  const actor = await requireCapability('admin:announcements.write');

  await prisma.announcement.delete({ where: { id } });

  await logAudit({
    userId: actor.id,
    action: 'ANNOUNCEMENT_DELETED',
    resource: 'Announcement',
    resourceId: id,
  });

  revalidatePath('/admin/announcements');
  revalidatePath('/announcements');
}

export async function toggleAnnouncementPin(id: string, pinned: boolean) {
  const actor = await requireCapability('admin:announcements.write');

  await prisma.announcement.update({
    where: { id },
    data: { pinned },
  });

  await logAudit({
    userId: actor.id,
    action: pinned ? 'ANNOUNCEMENT_PINNED' : 'ANNOUNCEMENT_UNPINNED',
    resource: 'Announcement',
    resourceId: id,
  });

  revalidatePath('/admin/announcements');
  revalidatePath('/announcements');
}
