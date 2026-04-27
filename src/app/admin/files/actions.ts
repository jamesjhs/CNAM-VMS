'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import fs from 'fs/promises';

export async function deleteFileAsset(fileId: string) {
  const actor = await requireCapability('admin:files.write');

  const db = getDb();
  type FileRow = { path: string; originalName: string };
  const file = db.prepare('SELECT path, originalName FROM file_assets WHERE id = ?').get(fileId) as FileRow | undefined;
  if (!file) return;

  // Remove the physical file if it exists
  try {
    await fs.unlink(file.path);
  } catch (err: unknown) {
    // ENOENT means the file is already gone — that's fine
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[Files] Error deleting file from disk:', err);
    }
  }

  db.prepare('DELETE FROM file_assets WHERE id = ?').run(fileId);

  await logAudit({
    userId: actor.id,
    action: 'FILE_DELETED',
    resource: 'FileAsset',
    resourceId: fileId,
    detail: { originalName: file.originalName },
  });

  revalidatePath('/admin/files');
}
