'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability, requireAuth } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import type { TaskType, TaskUrgency } from '@prisma/client';

// ---------------------------------------------------------------------------
// Team task CRUD (admin:tasks.write)
// ---------------------------------------------------------------------------

export async function createTeamTask(formData: FormData) {
  const actor = await requireCapability('admin:tasks.write');

  const teamId = (formData.get('teamId') as string | null) ?? '';
  const title = ((formData.get('title') as string | null) ?? '').trim();
  const taskType = (formData.get('taskType') as TaskType | null) ?? 'SITE';
  const urgency = (formData.get('urgency') as TaskUrgency | null) ?? 'ROUTINE';
  const description = ((formData.get('description') as string | null) ?? '').trim() || null;
  const personnelRequired = parseInt(formData.get('personnelRequired') as string) || null;
  const supervisorRequired = formData.get('supervisorRequired') === '1';
  const equipment = formData.getAll('equipment') as string[];
  const equipmentOther = ((formData.get('equipmentOther') as string | null) ?? '').trim() || null;
  const consumables = formData.getAll('consumables') as string[];
  const consumablesOther = ((formData.get('consumablesOther') as string | null) ?? '').trim() || null;
  const safetyIssues = formData.getAll('safetyIssues') as string[];
  const safetyIssuesOther = ((formData.get('safetyIssuesOther') as string | null) ?? '').trim() || null;
  const equipmentLocations = ((formData.get('equipmentLocations') as string | null) ?? '').trim() || null;

  if (!teamId || !title) return;

  const task = await prisma.teamTask.create({
    data: {
      teamId,
      title,
      taskType,
      urgency,
      description,
      personnelRequired,
      supervisorRequired,
      equipment,
      equipmentOther,
      consumables,
      consumablesOther,
      safetyIssues,
      safetyIssuesOther,
      equipmentLocations,
    },
  });

  await logAudit({
    userId: actor.id,
    action: 'TASK_CREATED',
    resource: 'TeamTask',
    resourceId: task.id,
    detail: { teamId, title },
  });

  revalidatePath('/admin/teams/tasks');
  revalidatePath(`/teams/${teamId}`);
}

export async function updateTeamTask(taskId: string, formData: FormData) {
  const actor = await requireCapability('admin:tasks.write');

  const title = ((formData.get('title') as string | null) ?? '').trim();
  const taskType = (formData.get('taskType') as TaskType | null) ?? 'SITE';
  const urgency = (formData.get('urgency') as TaskUrgency | null) ?? 'ROUTINE';
  const description = ((formData.get('description') as string | null) ?? '').trim() || null;
  const personnelRequired = parseInt(formData.get('personnelRequired') as string) || null;
  const supervisorRequired = formData.get('supervisorRequired') === '1';
  const equipment = formData.getAll('equipment') as string[];
  const equipmentOther = ((formData.get('equipmentOther') as string | null) ?? '').trim() || null;
  const consumables = formData.getAll('consumables') as string[];
  const consumablesOther = ((formData.get('consumablesOther') as string | null) ?? '').trim() || null;
  const safetyIssues = formData.getAll('safetyIssues') as string[];
  const safetyIssuesOther = ((formData.get('safetyIssuesOther') as string | null) ?? '').trim() || null;
  const equipmentLocations = ((formData.get('equipmentLocations') as string | null) ?? '').trim() || null;

  if (!title) return;

  const task = await prisma.teamTask.update({
    where: { id: taskId },
    data: {
      title,
      taskType,
      urgency,
      description,
      personnelRequired,
      supervisorRequired,
      equipment,
      equipmentOther,
      consumables,
      consumablesOther,
      safetyIssues,
      safetyIssuesOther,
      equipmentLocations,
    },
  });

  await logAudit({
    userId: actor.id,
    action: 'TASK_UPDATED',
    resource: 'TeamTask',
    resourceId: taskId,
    detail: { title },
  });

  revalidatePath('/admin/teams/tasks');
  revalidatePath(`/teams/${task.teamId}`);
}

export async function deleteTeamTask(taskId: string) {
  const actor = await requireCapability('admin:tasks.write');

  const task = await prisma.teamTask.findUnique({ where: { id: taskId }, select: { teamId: true } });
  await prisma.teamTask.delete({ where: { id: taskId } });

  await logAudit({
    userId: actor.id,
    action: 'TASK_DELETED',
    resource: 'TeamTask',
    resourceId: taskId,
  });

  revalidatePath('/admin/teams/tasks');
  if (task) revalidatePath(`/teams/${task.teamId}`);
}

// ---------------------------------------------------------------------------
// Work log — all authenticated members can add entries
// ---------------------------------------------------------------------------

export async function addWorkLogEntry(taskId: string, entry: string) {
  const actor = await requireAuth();

  const trimmed = entry.trim();
  if (!trimmed) return;

  await prisma.teamWorkLog.create({
    data: { taskId, userId: actor.id, entry: trimmed },
  });

  const task = await prisma.teamTask.findUnique({ where: { id: taskId }, select: { teamId: true } });
  if (task) revalidatePath(`/teams/${task.teamId}`);
}

// ---------------------------------------------------------------------------
// Feedback — all authenticated members can add feedback
// ---------------------------------------------------------------------------

export async function addTeamFeedback(teamId: string, feedback: string) {
  const actor = await requireAuth();

  const trimmed = feedback.trim();
  if (!trimmed) return;

  await prisma.teamFeedback.create({
    data: { teamId, userId: actor.id, feedback: trimmed },
  });

  revalidatePath(`/teams/${teamId}`);
}

// ---------------------------------------------------------------------------
// Admin: set team leader
// ---------------------------------------------------------------------------

export async function setTeamLeader(teamId: string, leaderId: string | null) {
  const actor = await requireCapability('admin:teams.write');

  await prisma.team.update({
    where: { id: teamId },
    data: { leaderId: leaderId || null },
  });

  await logAudit({
    userId: actor.id,
    action: 'TEAM_LEADER_SET',
    resource: 'Team',
    resourceId: teamId,
    detail: { leaderId },
  });

  revalidatePath('/admin/teams');
  revalidatePath(`/teams/${teamId}`);
}
