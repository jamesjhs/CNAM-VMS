'use server';

import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now } from '@/lib/db';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export async function createTrainingPolicy(
  title: string,
  description: string,
  frequency: string,
  roleIds: string[],
) {
  const actor = await requireCapability('admin:training.write');

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const db = getDb();
  const id = createId();
  const ts = now();
  db.prepare('INSERT INTO training_policies (id, title, description, frequency, createdAt, updatedAt) VALUES (?,?,?,?,?,?)').run(
    id, trimmedTitle, description.trim() || null, frequency.trim() || null, ts, ts,
  );
  for (const roleId of roleIds) {
    db.prepare('INSERT OR IGNORE INTO training_policy_roles (policyId, roleId) VALUES (?,?)').run(id, roleId);
  }

  await logAudit({
    userId: actor.id,
    action: 'TRAINING_POLICY_CREATED',
    resource: 'TrainingPolicy',
    resourceId: id,
    detail: { title: trimmedTitle, roleIds },
  });

  revalidatePath('/admin/training');
}

export async function updateTrainingPolicy(
  policyId: string,
  title: string,
  description: string,
  frequency: string,
  isActive: boolean,
  roleIds: string[],
) {
  const actor = await requireCapability('admin:training.write');

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const db = getDb();
  db.transaction(() => {
    db.prepare('UPDATE training_policies SET title=?, description=?, frequency=?, isActive=?, updatedAt=? WHERE id=?').run(
      trimmedTitle, description.trim() || null, frequency.trim() || null, isActive ? 1 : 0, now(), policyId,
    );
    db.prepare('DELETE FROM training_policy_roles WHERE policyId = ?').run(policyId);
    for (const roleId of roleIds) {
      db.prepare('INSERT INTO training_policy_roles (policyId, roleId) VALUES (?,?)').run(policyId, roleId);
    }
  })();

  await logAudit({
    userId: actor.id,
    action: 'TRAINING_POLICY_UPDATED',
    resource: 'TrainingPolicy',
    resourceId: policyId,
    detail: { title: trimmedTitle, roleIds, isActive },
  });

  revalidatePath('/admin/training');
}

export async function deleteTrainingPolicy(policyId: string) {
  const actor = await requireCapability('admin:training.write');

  const db = getDb();
  db.prepare('DELETE FROM training_policies WHERE id = ?').run(policyId);

  await logAudit({
    userId: actor.id,
    action: 'TRAINING_POLICY_DELETED',
    resource: 'TrainingPolicy',
    resourceId: policyId,
  });

  revalidatePath('/admin/training');
}
