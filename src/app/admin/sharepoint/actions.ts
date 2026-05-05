'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb, now } from '@/lib/db';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import {
  getSharePointConfig,
  ensureTopLevelFolders,
} from '@/lib/sharepoint';

const SP_KEYS = [
  'sharepoint.tenantId',
  'sharepoint.clientId',
  'sharepoint.clientSecret',
  'sharepoint.siteUrl',
  'sharepoint.driveName',
] as const;

type SpKey = (typeof SP_KEYS)[number];

export async function saveSharePointSettings(formData: FormData): Promise<void> {
  const actor = await requireCapability('admin:sharepoint.write');

  const db = getDb();
  const ts = now();

  const updates: Record<SpKey, string> = {
    'sharepoint.tenantId':     (formData.get('sharepoint.tenantId')     as string | null) ?? '',
    'sharepoint.clientId':     (formData.get('sharepoint.clientId')     as string | null) ?? '',
    'sharepoint.clientSecret': (formData.get('sharepoint.clientSecret') as string | null) ?? '',
    'sharepoint.siteUrl':      (formData.get('sharepoint.siteUrl')      as string | null) ?? '',
    'sharepoint.driveName':    (formData.get('sharepoint.driveName')    as string | null) ?? 'Documents',
  };

  for (const key of SP_KEYS) {
    const value = updates[key];
    // Skip secret if left blank (preserve existing)
    if (key === 'sharepoint.clientSecret' && value === '') continue;

    const existing = db.prepare('SELECT key FROM system_settings WHERE key = ?').get(key);
    if (existing) {
      db.prepare('UPDATE system_settings SET value=?, updatedAt=?, updatedById=? WHERE key=?').run(
        value, ts, actor.id, key,
      );
    } else {
      db.prepare('INSERT INTO system_settings (key, value, updatedAt, updatedById) VALUES (?,?,?,?)').run(
        key, value, ts, actor.id,
      );
    }
  }

  await logAudit({
    userId: actor.id,
    action: 'SHAREPOINT_SETTINGS_UPDATED',
    resource: 'SystemSettings',
    resourceId: 'sharepoint',
  });

  revalidatePath('/admin/sharepoint');
}

export async function clearSharePointSettings(): Promise<void> {
  const actor = await requireCapability('admin:sharepoint.write');

  const db = getDb();
  for (const key of SP_KEYS) {
    db.prepare('DELETE FROM system_settings WHERE key = ?').run(key);
  }

  await logAudit({
    userId: actor.id,
    action: 'SHAREPOINT_SETTINGS_CLEARED',
    resource: 'SystemSettings',
    resourceId: 'sharepoint',
  });

  revalidatePath('/admin/sharepoint');
}

export async function testSharePointConnection(): Promise<void> {
  await requireCapability('admin:sharepoint.write');

  const config = getSharePointConfig();
  if (!config) {
    redirect('/admin/sharepoint?testResult=error&testMessage=No+SharePoint+configuration+found');
  }

  try {
    await ensureTopLevelFolders(config);
    redirect('/admin/sharepoint?testResult=success');
  } catch (err) {
    const msg = encodeURIComponent(
      err instanceof Error ? err.message.slice(0, 200) : 'Unknown error',
    );
    redirect(`/admin/sharepoint?testResult=error&testMessage=${msg}`);
  }
}
