'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireCapability, requireAuth, hasCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import type { TaskType, TaskUrgency } from '@prisma/client';

// Allowed enum values — validated server-side to prevent invalid DB writes
const VALID_TASK_TYPES: TaskType[] = ['SITE', 'DISPLAY', 'AIRFRAME'];
const VALID_URGENCIES: TaskUrgency[] = ['ROUTINE', 'MODERATE', 'URGENT'];

function parseTaskType(raw: string | null): TaskType {
  return VALID_TASK_TYPES.includes(raw as TaskType) ? (raw as TaskType) : 'SITE';
}

function parseUrgency(raw: string | null): TaskUrgency {
  return VALID_URGENCIES.includes(raw as TaskUrgency) ? (raw as TaskUrgency) : 'ROUTINE';
}

/** Parse a positive integer; returns null for 0, negative, NaN, or missing. */
function parsePositiveInt(raw: string | null): number | null {
  const n = parseInt(raw ?? '');
  return n > 0 ? n : null;
}

/** Truncate to max length and return null if empty after trimming. */
function limitText(raw: string | null, max: number): string | null {
  return (raw ?? '').trim().slice(0, max) || null;
}

// ---------------------------------------------------------------------------
// Team task CRUD (admin:tasks.write)
// ---------------------------------------------------------------------------

export async function createTeamTask(formData: FormData) {
  const actor = await requireCapability('admin:tasks.write');

  const teamId = (formData.get('teamId') as string | null) ?? '';
  const title = limitText(formData.get('title') as string, 200) ?? '';
  const taskType = parseTaskType(formData.get('taskType') as string);
  const urgency = parseUrgency(formData.get('urgency') as string);
  const description = limitText(formData.get('description') as string, 3000);
  const personnelRequired = parsePositiveInt(formData.get('personnelRequired') as string);
  const supervisorRequired = formData.get('supervisorRequired') === '1';
  const equipment = formData.getAll('equipment') as string[];
  const equipmentOther = limitText(formData.get('equipmentOther') as string, 200);
  const consumables = formData.getAll('consumables') as string[];
  const consumablesOther = limitText(formData.get('consumablesOther') as string, 200);
  const safetyIssues = formData.getAll('safetyIssues') as string[];
  const safetyIssuesOther = limitText(formData.get('safetyIssuesOther') as string, 200);
  const equipmentLocations = limitText(formData.get('equipmentLocations') as string, 5000);

  if (!teamId || !title) {
    redirect('/admin/teams/tasks?error=MissingFields');
  }

  // Verify the team exists before writing
  const teamExists = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!teamExists) redirect('/admin/teams/tasks?error=TeamNotFound');

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
  redirect('/admin/teams/tasks?success=created');
}

export async function updateTeamTask(taskId: string, formData: FormData) {
  const actor = await requireCapability('admin:tasks.write');

  const title = limitText(formData.get('title') as string, 200) ?? '';
  const taskType = parseTaskType(formData.get('taskType') as string);
  const urgency = parseUrgency(formData.get('urgency') as string);
  const description = limitText(formData.get('description') as string, 3000);
  const personnelRequired = parsePositiveInt(formData.get('personnelRequired') as string);
  const supervisorRequired = formData.get('supervisorRequired') === '1';
  const equipment = formData.getAll('equipment') as string[];
  const equipmentOther = limitText(formData.get('equipmentOther') as string, 200);
  const consumables = formData.getAll('consumables') as string[];
  const consumablesOther = limitText(formData.get('consumablesOther') as string, 200);
  const safetyIssues = formData.getAll('safetyIssues') as string[];
  const safetyIssuesOther = limitText(formData.get('safetyIssuesOther') as string, 200);
  const equipmentLocations = limitText(formData.get('equipmentLocations') as string, 5000);

  if (!title) redirect('/admin/teams/tasks?error=MissingFields');

  // Verify the task exists before updating (prevents unhandled Prisma P2025)
  const existing = await prisma.teamTask.findUnique({ where: { id: taskId }, select: { teamId: true } });
  if (!existing) redirect('/admin/teams/tasks?error=NotFound');

  await prisma.teamTask.update({
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
  revalidatePath(`/teams/${existing.teamId}`);
  redirect('/admin/teams/tasks?success=updated');
}

export async function deleteTeamTask(taskId: string) {
  const actor = await requireCapability('admin:tasks.write');

  const task = await prisma.teamTask.findUnique({ where: { id: taskId }, select: { teamId: true } });
  if (!task) redirect('/admin/teams/tasks?error=NotFound');

  await prisma.teamTask.delete({ where: { id: taskId } });

  await logAudit({
    userId: actor.id,
    action: 'TASK_DELETED',
    resource: 'TeamTask',
    resourceId: taskId,
  });

  revalidatePath('/admin/teams/tasks');
  revalidatePath(`/teams/${task.teamId}`);
  redirect('/admin/teams/tasks?success=deleted');
}

// ---------------------------------------------------------------------------
// Work log — team members (and admins) can add entries
// ---------------------------------------------------------------------------

export async function addWorkLogEntry(taskId: string, entry: string) {
  const actor = await requireAuth();

  const trimmed = (entry ?? '').trim().slice(0, 2000);
  if (!trimmed) return;

  // Verify the task exists before writing (prevents FK constraint error)
  const task = await prisma.teamTask.findUnique({
    where: { id: taskId },
    select: { teamId: true, isActive: true },
  });
  if (!task || !task.isActive) redirect('/teams?error=TaskNotFound');

  // Enforce team membership — admins with admin:teams.read bypass this
  if (!hasCapability(actor, 'admin:teams.read')) {
    const membership = await prisma.userTeam.findUnique({
      where: { userId_teamId: { userId: actor.id, teamId: task.teamId } },
    });
    if (!membership) redirect(`/teams/${task.teamId}?error=NotMember`);
  }

  await prisma.teamWorkLog.create({
    data: { taskId, userId: actor.id, entry: trimmed },
  });

  revalidatePath(`/teams/${task.teamId}`);
  redirect(`/teams/${task.teamId}?success=log`);
}

// ---------------------------------------------------------------------------
// Feedback — team members (and admins) can submit feedback
// ---------------------------------------------------------------------------

export async function addTeamFeedback(teamId: string, feedback: string) {
  const actor = await requireAuth();

  const trimmed = (feedback ?? '').trim().slice(0, 2000);
  if (!trimmed) return;

  // Verify team exists
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
  if (!team) redirect('/teams?error=TeamNotFound');

  // Enforce team membership — admins bypass this
  if (!hasCapability(actor, 'admin:teams.read')) {
    const membership = await prisma.userTeam.findUnique({
      where: { userId_teamId: { userId: actor.id, teamId } },
    });
    if (!membership) redirect(`/teams/${teamId}?error=NotMember`);
  }

  await prisma.teamFeedback.create({
    data: { teamId, userId: actor.id, feedback: trimmed },
  });

  revalidatePath(`/teams/${teamId}`);
  redirect(`/teams/${teamId}?success=feedback`);
}

// ---------------------------------------------------------------------------
// Admin: set team leader
// ---------------------------------------------------------------------------

export async function setTeamLeader(teamId: string, leaderId: string | null) {
  const actor = await requireCapability('admin:teams.write');

  // Validate the proposed leader is a member of the team (or explicitly clearing)
  if (leaderId) {
    const membership = await prisma.userTeam.findUnique({
      where: { userId_teamId: { userId: leaderId, teamId } },
    });
    if (!membership) redirect('/admin/teams?error=NotMember');
  }

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
  redirect('/admin/teams?success=leader');
}

