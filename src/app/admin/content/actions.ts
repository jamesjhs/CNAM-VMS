'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export async function savePrivacyPolicy(content: string) {
  const actor = await requireCapability('admin:theme.write');

  const trimmed = content.trim();
  if (!trimmed) return;

  await prisma.siteContent.upsert({
    where: { key: 'privacy-policy' },
    update: { content: trimmed, updatedById: actor.id },
    create: { key: 'privacy-policy', content: trimmed, updatedById: actor.id },
  });

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
