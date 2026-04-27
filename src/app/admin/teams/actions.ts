'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now, packJson, unpackBool } from '@/lib/db';
import { requireCapability, requireAuth, hasCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import type { TaskType, TaskUrgency } from '@/lib/db-types';

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

  const db = getDb();
  // Verify the team exists before writing
  const teamExists = db.prepare('SELECT id FROM teams WHERE id = ?').get(teamId);
  if (!teamExists) redirect('/admin/teams/tasks?error=TeamNotFound');

  const id = createId();
  const ts = now();
  db.prepare(
    `INSERT INTO team_tasks (id, teamId, title, taskType, urgency, description, personnelRequired, supervisorRequired,
     equipment, equipmentOther, consumables, consumablesOther, safetyIssues, safetyIssuesOther, equipmentLocations, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id, teamId, title, taskType, urgency, description, personnelRequired, supervisorRequired ? 1 : 0,
    packJson(equipment), equipmentOther, packJson(consumables), consumablesOther,
    packJson(safetyIssues), safetyIssuesOther, equipmentLocations, ts, ts,
  );

  await logAudit({
    userId: actor.id,
    action: 'TASK_CREATED',
    resource: 'TeamTask',
    resourceId: id,
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

  const db = getDb();
  // Verify the task exists before updating
  const existing = db.prepare('SELECT teamId FROM team_tasks WHERE id = ?').get(taskId) as { teamId: string } | undefined;
  if (!existing) redirect('/admin/teams/tasks?error=NotFound');

  db.prepare(
    `UPDATE team_tasks SET title=?, taskType=?, urgency=?, description=?, personnelRequired=?, supervisorRequired=?,
     equipment=?, equipmentOther=?, consumables=?, consumablesOther=?, safetyIssues=?, safetyIssuesOther=?,
     equipmentLocations=?, updatedAt=? WHERE id=?`,
  ).run(
    title, taskType, urgency, description, personnelRequired, supervisorRequired ? 1 : 0,
    packJson(equipment), equipmentOther, packJson(consumables), consumablesOther,
    packJson(safetyIssues), safetyIssuesOther, equipmentLocations, now(), taskId,
  );

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

  const db = getDb();
  const task = db.prepare('SELECT teamId FROM team_tasks WHERE id = ?').get(taskId) as { teamId: string } | undefined;
  if (!task) redirect('/admin/teams/tasks?error=NotFound');

  db.prepare('DELETE FROM team_tasks WHERE id = ?').run(taskId);

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

  const db = getDb();
  // Verify the task exists before writing (prevents FK constraint error)
  const task = db.prepare('SELECT teamId, isActive FROM team_tasks WHERE id = ?').get(taskId) as { teamId: string; isActive: number } | undefined;
  if (!task || !unpackBool(task.isActive)) redirect('/teams?error=TaskNotFound');

  // Enforce team membership — admins with admin:teams.read bypass this
  if (!hasCapability(actor, 'admin:teams.read')) {
    const membership = db.prepare('SELECT userId FROM user_teams WHERE userId = ? AND teamId = ?').get(actor.id, task.teamId);
    if (!membership) redirect(`/teams/${task.teamId}?error=NotMember`);
  }

  db.prepare('INSERT INTO team_work_logs (id, taskId, userId, entry, createdAt) VALUES (?,?,?,?,?)').run(
    createId(), taskId, actor.id, trimmed, now(),
  );

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

  const db = getDb();
  // Verify team exists
  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(teamId);
  if (!team) redirect('/teams?error=TeamNotFound');

  // Enforce team membership — admins bypass this
  if (!hasCapability(actor, 'admin:teams.read')) {
    const membership = db.prepare('SELECT userId FROM user_teams WHERE userId = ? AND teamId = ?').get(actor.id, teamId);
    if (!membership) redirect(`/teams/${teamId}?error=NotMember`);
  }

  db.prepare('INSERT INTO team_feedback (id, teamId, userId, feedback, createdAt) VALUES (?,?,?,?,?)').run(
    createId(), teamId, actor.id, trimmed, now(),
  );

  revalidatePath(`/teams/${teamId}`);
  redirect(`/teams/${teamId}?success=feedback`);
}

// ---------------------------------------------------------------------------
// Admin: toggle team leader status for a member
// ---------------------------------------------------------------------------

export async function toggleTeamLeader(teamId: string, userId: string) {
  const actor = await requireCapability('admin:teams.write');

  const db = getDb();
  // The user must already be a member of the team
  const membership = db.prepare('SELECT isLeader FROM user_teams WHERE userId = ? AND teamId = ?').get(userId, teamId) as { isLeader: number } | undefined;
  if (!membership) redirect('/admin/teams?error=NotMember');

  const newIsLeader = unpackBool(membership.isLeader) ? 0 : 1;
  db.prepare('UPDATE user_teams SET isLeader=? WHERE userId=? AND teamId=?').run(newIsLeader, userId, teamId);

  await logAudit({
    userId: actor.id,
    action: newIsLeader ? 'TEAM_LEADER_ADDED' : 'TEAM_LEADER_REMOVED',
    resource: 'Team',
    resourceId: teamId,
    detail: { userId },
  });

  revalidatePath('/admin/teams');
  revalidatePath(`/teams/${teamId}`);
  redirect('/admin/teams?success=leader');
}
