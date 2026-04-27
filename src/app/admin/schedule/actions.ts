'use server';

import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now, packDate, packJson } from '@/lib/db';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import type { CalendarEventType } from '@/lib/db-types';
import { parseDate } from '@/lib/calendar';

/** Accept only 3- or 6-digit hex colour codes (e.g. #fff or #6366f1). */
const HEX_COLOUR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DEFAULT_COLOUR = '#6366f1';

function safeColour(raw: string): string {
  return HEX_COLOUR_RE.test(raw) ? raw : DEFAULT_COLOUR;
}

// ---------------------------------------------------------------------------
// Calendar event actions
// ---------------------------------------------------------------------------

export async function createCalendarEvent(
  title: string,
  description: string,
  eventType: CalendarEventType,
  dateStr: string,
  startTime: string,
  endTime: string,
  jobId: string,
  maxSignupsStr: string,
  teamId: string,
) {
  const actor = await requireCapability('admin:calendar.write');

  const trimmedTitle = title.trim();
  if (!trimmedTitle || !dateStr) return;

  const date = parseDate(dateStr);
  if (!date) return;

  const db = getDb();
  const id = createId();
  const ts = now();
  db.prepare(
    `INSERT INTO calendar_events (id, title, description, eventType, date, startTime, endTime, jobId, teamId, maxSignups, createdById, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id, trimmedTitle, description.trim() || null, eventType, packDate(date),
    startTime.trim() || null, endTime.trim() || null, jobId || null, teamId || null,
    maxSignupsStr ? parseInt(maxSignupsStr, 10) : null, actor.id, ts, ts,
  );

  await logAudit({
    userId: actor.id,
    action: 'CALENDAR_EVENT_CREATED',
    resource: 'CalendarEvent',
    resourceId: id,
    detail: { title: trimmedTitle, date: dateStr, eventType },
  });

  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
}

export async function deleteCalendarEvent(eventId: string) {
  const actor = await requireCapability('admin:calendar.write');

  const db = getDb();
  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(eventId);

  await logAudit({
    userId: actor.id,
    action: 'CALENDAR_EVENT_DELETED',
    resource: 'CalendarEvent',
    resourceId: eventId,
  });

  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
}

// ---------------------------------------------------------------------------
// Job actions
// ---------------------------------------------------------------------------

export async function createJob(
  title: string,
  description: string,
  isRolling: boolean,
  colour: string,
  scheduleType: string,
  weekDays: number[],
  monthDays: number[],
  defaultStartTime: string,
  defaultEndTime: string,
  defaultMaxSignupsStr: string,
) {
  const actor = await requireCapability('admin:calendar.write');

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const db = getDb();
  const id = createId();
  const ts = now();
  db.prepare(
    `INSERT INTO jobs (id, title, description, isRolling, colour, scheduleType, weekDays, monthDays, defaultStartTime, defaultEndTime, defaultMaxSignups, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id, trimmedTitle, description.trim() || null, isRolling ? 1 : 0, safeColour(colour),
    scheduleType || 'ONE_OFF', packJson(weekDays), packJson(monthDays),
    defaultStartTime.trim() || null, defaultEndTime.trim() || null,
    defaultMaxSignupsStr ? parseInt(defaultMaxSignupsStr, 10) : null, ts, ts,
  );

  await logAudit({
    userId: actor.id,
    action: 'JOB_CREATED',
    resource: 'Job',
    resourceId: id,
    detail: { title: trimmedTitle, isRolling, scheduleType },
  });

  revalidatePath('/admin/schedule/jobs');
  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
}

export async function updateJob(
  jobId: string,
  title: string,
  description: string,
  isRolling: boolean,
  colour: string,
  scheduleType: string,
  weekDays: number[],
  monthDays: number[],
  defaultStartTime: string,
  defaultEndTime: string,
  defaultMaxSignupsStr: string,
) {
  const actor = await requireCapability('admin:calendar.write');

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const db = getDb();
  db.prepare(
    `UPDATE jobs SET title=?, description=?, isRolling=?, colour=?, scheduleType=?, weekDays=?, monthDays=?,
     defaultStartTime=?, defaultEndTime=?, defaultMaxSignups=?, updatedAt=? WHERE id=?`,
  ).run(
    trimmedTitle, description.trim() || null, isRolling ? 1 : 0, safeColour(colour),
    scheduleType || 'ONE_OFF', packJson(weekDays), packJson(monthDays),
    defaultStartTime.trim() || null, defaultEndTime.trim() || null,
    defaultMaxSignupsStr ? parseInt(defaultMaxSignupsStr, 10) : null, now(), jobId,
  );

  await logAudit({
    userId: actor.id,
    action: 'JOB_UPDATED',
    resource: 'Job',
    resourceId: jobId,
    detail: { title: trimmedTitle, isRolling, scheduleType },
  });

  revalidatePath('/admin/schedule/jobs');
  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
}

export async function deleteJob(jobId: string) {
  const actor = await requireCapability('admin:calendar.write');

  const db = getDb();
  db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);

  await logAudit({
    userId: actor.id,
    action: 'JOB_DELETED',
    resource: 'Job',
    resourceId: jobId,
  });

  revalidatePath('/admin/schedule/jobs');
  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
}

// ---------------------------------------------------------------------------
// Recurring job occurrence — find or create a CalendarEvent for a specific
// job+date, then create an EventSignup for the current user.
// ---------------------------------------------------------------------------

export async function adminSignupForJobOccurrence(jobId: string, dateStr: string) {
  const actor = await requireCapability('admin:calendar.write');

  const date = parseDate(dateStr);
  if (!date) return;

  const db = getDb();
  type JobRow = { title: string; description: string | null; defaultStartTime: string | null; defaultEndTime: string | null; defaultMaxSignups: number | null };
  const job = db.prepare('SELECT title, description, defaultStartTime, defaultEndTime, defaultMaxSignups FROM jobs WHERE id = ?').get(jobId) as JobRow | undefined;
  if (!job) return;

  const dateStr2 = packDate(date);
  let eventId = (db.prepare('SELECT id FROM calendar_events WHERE jobId = ? AND date = ?').get(jobId, dateStr2) as { id: string } | undefined)?.id;

  if (!eventId) {
    eventId = createId();
    const ts = now();
    db.prepare(
      `INSERT INTO calendar_events (id, title, description, eventType, date, startTime, endTime, maxSignups, jobId, createdById, createdAt, updatedAt)
       VALUES (?,?,?,'HELP_NEEDED',?,?,?,?,?,?,?,?)`,
    ).run(eventId, job.title, job.description, dateStr2, job.defaultStartTime, job.defaultEndTime, job.defaultMaxSignups, jobId, actor.id, ts, ts);
  }

  db.prepare('INSERT OR IGNORE INTO event_signups (id, eventId, userId, signedUpAt) VALUES (?,?,?,?)').run(createId(), eventId, actor.id, now());

  await logAudit({
    userId: actor.id,
    action: 'EVENT_SIGNUP',
    resource: 'CalendarEvent',
    resourceId: eventId,
  });

  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
}
