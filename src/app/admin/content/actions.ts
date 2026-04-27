'use server';

import { revalidatePath } from 'next/cache';
import { getDb, now } from '@/lib/db';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export async function savePrivacyPolicy(content: string) {
  const actor = await requireCapability('admin:theme.write');

  const trimmed = content.trim();
  if (!trimmed) return;

  const db = getDb();
  const ts = now();
  const existing = db.prepare("SELECT key FROM site_content WHERE key = 'privacy-policy'").get();
  if (existing) {
    db.prepare("UPDATE site_content SET content=?, updatedAt=?, updatedById=? WHERE key='privacy-policy'").run(trimmed, ts, actor.id);
  } else {
    db.prepare("INSERT INTO site_content (key, content, updatedAt, updatedById) VALUES ('privacy-policy',?,?,?)").run(trimmed, ts, actor.id);
  }

  await logAudit({
    userId: actor.id,
    action: 'SITE_CONTENT_UPDATED',
    resource: 'SiteContent',
    resourceId: 'privacy-policy',
    detail: { key: 'privacy-policy' },
  });

  revalidatePath('/privacy');
  revalidatePath('/admin/content');
}
