'use server';

import { revalidatePath } from 'next/cache';
import { getDb, now } from '@/lib/db';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

const SMTP_KEYS = [
  'smtp.host',
  'smtp.port',
  'smtp.user',
  'smtp.password',
  'smtp.from',
  'smtp.secure',
  'smtp.requireTls',
  'smtp.tlsRejectUnauthorized',
] as const;

type SmtpKey = (typeof SMTP_KEYS)[number];

export async function saveSmtpSettings(formData: FormData): Promise<void> {
  const actor = await requireCapability('admin:settings.write');

  const db = getDb();
  const ts = now();

  const updates: Record<SmtpKey, string> = {
    'smtp.host':                 (formData.get('smtp.host')                 as string | null) ?? '',
    'smtp.port':                 (formData.get('smtp.port')                 as string | null) ?? '587',
    'smtp.user':                 (formData.get('smtp.user')                 as string | null) ?? '',
    'smtp.password':             (formData.get('smtp.password')             as string | null) ?? '',
    'smtp.from':                 (formData.get('smtp.from')                 as string | null) ?? '',
    'smtp.secure':               (formData.get('smtp.secure')               as string | null) ?? 'false',
    'smtp.requireTls':           (formData.get('smtp.requireTls')           as string | null) ?? 'false',
    'smtp.tlsRejectUnauthorized': (formData.get('smtp.tlsRejectUnauthorized') as string | null) ?? 'true',
  };

  // Upsert each setting; skip password if it was left blank (keep existing value)
  for (const key of SMTP_KEYS) {
    const value = updates[key];

    // If the password field is blank, preserve whatever is already in the DB
    if (key === 'smtp.password' && value === '') {
      continue;
    }

    const existing = db.prepare('SELECT key FROM system_settings WHERE key = ?').get(key);
    if (existing) {
      db.prepare('UPDATE system_settings SET value=?, updatedAt=?, updatedById=? WHERE key=?').run(value, ts, actor.id, key);
    } else {
      db.prepare('INSERT INTO system_settings (key, value, updatedAt, updatedById) VALUES (?,?,?,?)').run(key, value, ts, actor.id);
    }
  }

  await logAudit({
    userId: actor.id,
    action: 'SMTP_SETTINGS_UPDATED',
    resource: 'SystemSettings',
    resourceId: 'smtp',
  });

  revalidatePath('/admin/settings');
}

export async function clearSmtpSettings(): Promise<void> {
  const actor = await requireCapability('admin:settings.write');

  const db = getDb();
  for (const key of SMTP_KEYS) {
    db.prepare('DELETE FROM system_settings WHERE key = ?').run(key);
  }

  await logAudit({
    userId: actor.id,
    action: 'SMTP_SETTINGS_CLEARED',
    resource: 'SystemSettings',
    resourceId: 'smtp',
  });

  revalidatePath('/admin/settings');
}
