'use server';

import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now } from '@/lib/db';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 10000;

export async function createAnnouncement(title: string, body: string, pinned: boolean) {
  const actor = await requireCapability('admin:announcements.write');

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (!trimmedTitle || !trimmedBody) return;
  if (trimmedTitle.length > MAX_TITLE_LENGTH || trimmedBody.length > MAX_BODY_LENGTH) return;

  const db = getDb();
  const id = createId();
  const ts = now();
  db.prepare('INSERT INTO announcements (id, title, body, pinned, authorId, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)').run(
    id, trimmedTitle, trimmedBody, pinned ? 1 : 0, actor.id, ts, ts,
  );

  await logAudit({
    userId: actor.id,
    action: 'ANNOUNCEMENT_CREATED',
    resource: 'Announcement',
    resourceId: id,
    detail: { title: trimmedTitle, pinned },
  });

  revalidatePath('/admin/announcements');
  revalidatePath('/announcements');
}

export async function deleteAnnouncement(id: string) {
  const actor = await requireCapability('admin:announcements.write');

  const db = getDb();
  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);

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

  const db = getDb();
  db.prepare('UPDATE announcements SET pinned=?, updatedAt=? WHERE id=?').run(pinned ? 1 : 0, now(), id);

  await logAudit({
    userId: actor.id,
    action: pinned ? 'ANNOUNCEMENT_PINNED' : 'ANNOUNCEMENT_UNPINNED',
    resource: 'Announcement',
    resourceId: id,
  });

  revalidatePath('/admin/announcements');
  revalidatePath('/announcements');
}
