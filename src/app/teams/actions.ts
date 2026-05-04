'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now, unpackBool } from '@/lib/db';
import { requireAuth, hasCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

// ---------------------------------------------------------------------------
// Request to join a team
// ---------------------------------------------------------------------------

export async function requestToJoinTeam(teamId: string): Promise<void> {
  const actor = await requireAuth();
  const db = getDb();

  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(teamId);
  if (!team) redirect('/teams');

  // Already a member — nothing to do
  const existing = db.prepare(
    'SELECT 1 FROM user_teams WHERE userId = ? AND teamId = ?',
  ).get(actor.id, teamId);
  if (existing) redirect('/teams');

  // Upsert a PENDING request (re-allows requesting after a DENIED decision)
  db.prepare(
    `INSERT INTO team_join_requests (id, teamId, userId, status, requestedAt)
     VALUES (?, ?, ?, 'PENDING', ?)
     ON CONFLICT(teamId, userId) DO UPDATE SET status = 'PENDING', requestedAt = excluded.requestedAt, resolvedAt = NULL, resolvedById = NULL`,
  ).run(createId(), teamId, actor.id, now());

  await logAudit({
    userId: actor.id,
    action: 'TEAM_JOIN_REQUESTED',
    resource: 'Team',
    resourceId: teamId,
  });

  revalidatePath('/teams');
  redirect('/teams?success=requested');
}

// ---------------------------------------------------------------------------
// Helpers for leader / admin authorisation
// ---------------------------------------------------------------------------

function assertLeaderOrAdmin(
  actorId: string,
  teamId: string,
  capabilities: string[],
  db: ReturnType<typeof getDb>,
): void {
  const isAdmin = capabilities.includes('admin:teams.write');
  if (isAdmin) return;

  const row = db.prepare(
    'SELECT isLeader FROM user_teams WHERE userId = ? AND teamId = ?',
  ).get(actorId, teamId) as { isLeader: number } | undefined;

  if (!row || !unpackBool(row.isLeader)) {
    redirect('/teams');
  }
}

// ---------------------------------------------------------------------------
// Approve a join request (team leader or admin)
// ---------------------------------------------------------------------------

export async function approveJoinRequest(requestId: string): Promise<void> {
  const actor = await requireAuth();
  const db = getDb();

  const req = db.prepare(
    `SELECT id, teamId, userId, status FROM team_join_requests WHERE id = ?`,
  ).get(requestId) as {
    id: string; teamId: string; userId: string; status: string;
  } | undefined;

  if (!req || req.status !== 'PENDING') redirect('/teams');

  assertLeaderOrAdmin(actor.id, req.teamId, actor.capabilities, db);

  const ts = now();
  db.transaction(() => {
    db.prepare(
      `INSERT OR IGNORE INTO user_teams (userId, teamId, isLeader, joinedAt)
       VALUES (?, ?, 0, ?)`,
    ).run(req.userId, req.teamId, ts);

    db.prepare(
      `UPDATE team_join_requests SET status = 'APPROVED', resolvedAt = ?, resolvedById = ? WHERE id = ?`,
    ).run(ts, actor.id, requestId);
  })();

  await logAudit({
    userId: actor.id,
    action: 'TEAM_JOIN_APPROVED',
    resource: 'Team',
    resourceId: req.teamId,
    detail: { newMemberId: req.userId },
  });

  revalidatePath(`/teams/${req.teamId}`);
  revalidatePath('/teams');
  redirect(`/teams/${req.teamId}?success=approved`);
}

// ---------------------------------------------------------------------------
// Deny a join request (team leader or admin)
// ---------------------------------------------------------------------------

export async function denyJoinRequest(requestId: string): Promise<void> {
  const actor = await requireAuth();
  const db = getDb();

  const req = db.prepare(
    `SELECT id, teamId, userId, status FROM team_join_requests WHERE id = ?`,
  ).get(requestId) as {
    id: string; teamId: string; userId: string; status: string;
  } | undefined;

  if (!req || req.status !== 'PENDING') redirect('/teams');

  assertLeaderOrAdmin(actor.id, req.teamId, actor.capabilities, db);

  const ts = now();
  db.prepare(
    `UPDATE team_join_requests SET status = 'DENIED', resolvedAt = ?, resolvedById = ? WHERE id = ?`,
  ).run(ts, actor.id, requestId);

  await logAudit({
    userId: actor.id,
    action: 'TEAM_JOIN_DENIED',
    resource: 'Team',
    resourceId: req.teamId,
    detail: { deniedUserId: req.userId },
  });

  revalidatePath(`/teams/${req.teamId}`);
  redirect(`/teams/${req.teamId}?success=denied`);
}

// ---------------------------------------------------------------------------
// Set / unset team leader status (team leader or admin)
// ---------------------------------------------------------------------------

export async function setTeamLeaderStatus(teamId: string, userId: string, makeLeader: boolean): Promise<void> {
  const actor = await requireAuth();
  const db = getDb();

  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(teamId);
  if (!team) redirect('/teams');

  assertLeaderOrAdmin(actor.id, teamId, actor.capabilities, db);

  const membership = db.prepare(
    'SELECT isLeader FROM user_teams WHERE userId = ? AND teamId = ?',
  ).get(userId, teamId) as { isLeader: number } | undefined;
  if (!membership) redirect(`/teams/${teamId}?error=NotMember`);

  db.prepare('UPDATE user_teams SET isLeader = ? WHERE userId = ? AND teamId = ?').run(
    makeLeader ? 1 : 0,
    userId,
    teamId,
  );

  await logAudit({
    userId: actor.id,
    action: makeLeader ? 'TEAM_LEADER_ADDED' : 'TEAM_LEADER_REMOVED',
    resource: 'Team',
    resourceId: teamId,
    detail: { userId },
  });

  revalidatePath(`/teams/${teamId}`);
  revalidatePath('/teams');
  redirect(`/teams/${teamId}?success=leader`);
}

// ---------------------------------------------------------------------------
// Add a team member directly (team leader or admin)
// ---------------------------------------------------------------------------

export async function addTeamMemberByLeader(teamId: string, formData: FormData): Promise<void> {
  const actor = await requireAuth();
  const db = getDb();

  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(teamId);
  if (!team) redirect('/teams');

  assertLeaderOrAdmin(actor.id, teamId, actor.capabilities, db);

  const trimmedEmail = ((formData.get('email') as string | null) ?? '').trim().toLowerCase();
  if (!trimmedEmail) redirect(`/teams/${teamId}?error=MissingEmail`);

  const targetUser = db.prepare(
    `SELECT id FROM users WHERE LOWER(email) = ? AND status = 'ACTIVE'`,
  ).get(trimmedEmail) as { id: string } | undefined;

  if (!targetUser) redirect(`/teams/${teamId}?error=UserNotFound`);

  const alreadyMember = db.prepare(
    'SELECT 1 FROM user_teams WHERE userId = ? AND teamId = ?',
  ).get(targetUser.id, teamId);

  if (alreadyMember) redirect(`/teams/${teamId}?error=AlreadyMember`);

  const ts = now();
  db.transaction(() => {
    db.prepare(
      `INSERT OR IGNORE INTO user_teams (userId, teamId, isLeader, joinedAt) VALUES (?, ?, 0, ?)`,
    ).run(targetUser.id, teamId, ts);

    // If a pending join request exists, mark it approved
    db.prepare(
      `UPDATE team_join_requests SET status = 'APPROVED', resolvedAt = ?, resolvedById = ?
       WHERE teamId = ? AND userId = ? AND status = 'PENDING'`,
    ).run(ts, actor.id, teamId, targetUser.id);
  })();

  await logAudit({
    userId: actor.id,
    action: 'TEAM_MEMBER_ADDED',
    resource: 'Team',
    resourceId: teamId,
    detail: { newMemberId: targetUser.id, email: trimmedEmail },
  });

  revalidatePath(`/teams/${teamId}`);
  revalidatePath('/teams');
  redirect(`/teams/${teamId}?success=added`);
}
