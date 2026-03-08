'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import type { UserAccountType } from '@prisma/client';

export async function createTrainingPolicy(
  title: string,
  description: string,
  frequency: string,
  accountTypes: UserAccountType[],
) {
  const actor = await requireCapability('admin:training.write');

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const policy = await prisma.trainingPolicy.create({
    data: {
      title: trimmedTitle,
      description: description.trim() || null,
      frequency: frequency.trim() || null,
      roleAssignments: {
        create: accountTypes.map((accountType) => ({ accountType })),
      },
    },
  });

  await logAudit({
    userId: actor.id,
    action: 'TRAINING_POLICY_CREATED',
    resource: 'TrainingPolicy',
    resourceId: policy.id,
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

  await prisma.$transaction([
    prisma.trainingPolicy.update({
      where: { id: policyId },
      data: {
        title: trimmedTitle,
        description: description.trim() || null,
        frequency: frequency.trim() || null,
        isActive,
      },
    }),
    // Replace role assignments
    prisma.trainingPolicyRole.deleteMany({ where: { policyId } }),
    ...accountTypes.map((accountType) =>
      prisma.trainingPolicyRole.create({ data: { policyId, accountType } }),
    ),
  ]);

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

  await prisma.trainingPolicy.delete({ where: { id: policyId } });

  await logAudit({
    userId: actor.id,
    action: 'TRAINING_POLICY_DELETED',
    resource: 'TrainingPolicy',
    resourceId: policyId,
  });

  revalidatePath('/admin/training');
}
