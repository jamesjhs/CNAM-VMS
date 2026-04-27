'use server';

import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now } from '@/lib/db';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import type { UserAccountType } from '@/lib/db-types';

export async function createTrainingPolicy(
  title: string,
  description: string,
  frequency: string,
  accountTypes: UserAccountType[],
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
  for (const accountType of accountTypes) {
    db.prepare('INSERT OR IGNORE INTO training_policy_roles (policyId, accountType) VALUES (?,?)').run(id, accountType);
  }

  await logAudit({
    userId: actor.id,
    action: 'TRAINING_POLICY_CREATED',
    resource: 'TrainingPolicy',
    resourceId: id,
    detail: { title: trimmedTitle, accountTypes },
  });

  revalidatePath('/admin/training');
}

export async function updateTrainingPolicy(
  policyId: string,
  title: string,
  description: string,
  frequency: string,
  isActive: boolean,
  accountTypes: UserAccountType[],
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
    for (const accountType of accountTypes) {
      db.prepare('INSERT INTO training_policy_roles (policyId, accountType) VALUES (?,?)').run(policyId, accountType);
    }
  })();

  await logAudit({
    userId: actor.id,
    action: 'TRAINING_POLICY_UPDATED',
    resource: 'TrainingPolicy',
    resourceId: policyId,
    detail: { title: trimmedTitle, accountTypes, isActive },
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
