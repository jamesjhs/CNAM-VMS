'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import fs from 'fs/promises';

export async function deleteFileAsset(fileId: string) {
  const actor = await requireCapability('admin:files.write');

  const file = await prisma.fileAsset.findUnique({ where: { id: fileId } });
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

  await prisma.fileAsset.delete({ where: { id: fileId } });

  await logAudit({
    userId: actor.id,
    action: 'FILE_DELETED',
    resource: 'FileAsset',
    resourceId: fileId,
    detail: { originalName: file.originalName },
  });

  revalidatePath('/admin/files');
}
