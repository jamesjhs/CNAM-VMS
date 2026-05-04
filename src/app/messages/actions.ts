'use server';

import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now } from '@/lib/db';
import { requireAuth, hasCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';

export async function sendDirectMessage(recipientId: string, body: string): Promise<void> {
  const actor = await requireAuth();

  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message body cannot be empty.');
  if (trimmed.length > 2000) throw new Error('Message body must be 2000 characters or fewer.');

  const db = getDb();

  const recipient = db.prepare('SELECT id FROM users WHERE id = ?').get(recipientId) as { id: string } | undefined;
  if (!recipient) throw new Error('Recipient not found.');

  const ts = now();
  const msgId = createId();

  db.prepare(
    `INSERT INTO messages (id, body, senderId, teamId, recipientId, isDeleted, createdAt, updatedAt)
     VALUES (?, ?, ?, NULL, ?, 0, ?, ?)`,
  ).run(msgId, trimmed, actor.id, recipientId, ts, ts);

  // Mark sender's own read for this conversation
  db.prepare(
    `INSERT OR REPLACE INTO message_reads (userId, context, lastReadAt) VALUES (?, ?, ?)`,
  ).run(actor.id, `direct:${recipientId}`, ts);

  await logAudit({
    userId: actor.id,
    action: 'MESSAGE_SENT',
    resource: 'Message',
    resourceId: msgId,
    detail: { recipientId },
  });

  revalidatePath('/messages');
  revalidatePath(`/messages/${recipientId}`);
}

export async function sendTeamMessage(teamId: string, body: string): Promise<void> {
  const actor = await requireAuth();

  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message body cannot be empty.');
  if (trimmed.length > 2000) throw new Error('Message body must be 2000 characters or fewer.');

  const db = getDb();

  const isMember = db.prepare(
    'SELECT 1 FROM user_teams WHERE userId = ? AND teamId = ?',
  ).get(actor.id, teamId) as { 1: number } | undefined;

  const isAdmin = hasCapability(actor, 'admin:teams.read');

  if (!isMember && !isAdmin) throw new Error('You are not a member of this team.');

  const ts = now();
  const msgId = createId();

  db.prepare(
    `INSERT INTO messages (id, body, senderId, teamId, recipientId, isDeleted, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NULL, 0, ?, ?)`,
  ).run(msgId, trimmed, actor.id, teamId, ts, ts);

  // Mark sender's own read for this team conversation
  db.prepare(
    `INSERT OR REPLACE INTO message_reads (userId, context, lastReadAt) VALUES (?, ?, ?)`,
  ).run(actor.id, `team:${teamId}`, ts);

  await logAudit({
    userId: actor.id,
    action: 'TEAM_MESSAGE_SENT',
    resource: 'Message',
    resourceId: msgId,
    detail: { teamId },
  });

  revalidatePath(`/teams/${teamId}/messages`);
}

export async function deleteMessage(messageId: string): Promise<void> {
  const actor = await requireAuth();

  const db = getDb();

  const msg = db.prepare(
    'SELECT id, senderId, teamId, recipientId FROM messages WHERE id = ? AND isDeleted = 0',
  ).get(messageId) as {
    id: string; senderId: string | null; teamId: string | null; recipientId: string | null;
  } | undefined;

  if (!msg) return;

  const canDelete =
    msg.senderId === actor.id || hasCapability(actor, 'admin:users.write');

  if (!canDelete) throw new Error('You do not have permission to delete this message.');

  const ts = now();
  db.prepare(
    'UPDATE messages SET isDeleted = 1, deletedAt = ?, updatedAt = ? WHERE id = ?',
  ).run(ts, ts, messageId);

  revalidatePath('/messages');
  if (msg.recipientId) {
    revalidatePath(`/messages/${msg.recipientId}`);
    // Also revalidate from the other side
    if (msg.senderId) revalidatePath(`/messages/${msg.senderId}`);
  }
  if (msg.teamId) {
    revalidatePath(`/teams/${msg.teamId}/messages`);
  }
}

export async function reportMessage(messageId: string): Promise<void> {
  const actor = await requireAuth();

  const db = getDb();

  db.prepare(
    `INSERT OR IGNORE INTO message_reports (id, messageId, reportedById, createdAt)
     VALUES (?, ?, ?, ?)`,
  ).run(createId(), messageId, actor.id, now());

  revalidatePath('/messages');
}

export async function markDirectRead(otherUserId: string): Promise<void> {
  const actor = await requireAuth();

  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO message_reads (userId, context, lastReadAt) VALUES (?, ?, ?)`,
  ).run(actor.id, `direct:${otherUserId}`, now());
}

export async function markTeamRead(teamId: string): Promise<void> {
  const actor = await requireAuth();

  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO message_reads (userId, context, lastReadAt) VALUES (?, ?, ?)`,
  ).run(actor.id, `team:${teamId}`, now());
}
