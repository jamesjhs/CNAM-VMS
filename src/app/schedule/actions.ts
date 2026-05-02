'use server';

import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now, packDate, packJson } from '@/lib/db';
import { requireAuth, requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import { parseDate } from '@/lib/calendar';

// ---------------------------------------------------------------------------
// Event sign-up / withdrawal
// ---------------------------------------------------------------------------

export async function signupForEvent(eventId: string) {
  const actor = await requireAuth();

  const db = getDb();
  // Verify the event exists and has capacity
  const event = db.prepare('SELECT id, maxSignups FROM calendar_events WHERE id = ?').get(eventId) as { id: string; maxSignups: number | null } | undefined;
  if (!event) return;

  if (event.maxSignups !== null) {
    const { n } = db.prepare('SELECT COUNT(*) as n FROM event_signups WHERE eventId = ?').get(eventId) as { n: number };
    if (n >= event.maxSignups) return; // full
  }

  db.prepare('INSERT OR IGNORE INTO event_signups (id, eventId, userId, signedUpAt) VALUES (?,?,?,?)').run(createId(), eventId, actor.id, now());

  await logAudit({
    userId: actor.id,
    action: 'EVENT_SIGNUP',
    resource: 'CalendarEvent',
    resourceId: eventId,
  });

  revalidatePath('/schedule');
}

export async function withdrawFromEvent(eventId: string) {
  const actor = await requireAuth();

  const db = getDb();
  db.prepare('DELETE FROM event_signups WHERE eventId = ? AND userId = ?').run(eventId, actor.id);

  await logAudit({
    userId: actor.id,
    action: 'EVENT_WITHDRAWAL',
    resource: 'CalendarEvent',
    resourceId: eventId,
  });

  revalidatePath('/schedule');
}

// ---------------------------------------------------------------------------
// Recurring job occurrence sign-up / withdrawal.
// ---------------------------------------------------------------------------

export async function signupForJobOccurrence(jobId: string, dateStr: string) {
  const actor = await requireAuth();

  const date = parseDate(dateStr);
  if (!date) return;

  const db = getDb();
  type JobRow = { title: string; description: string | null; defaultStartTime: string | null; defaultEndTime: string | null; defaultMaxSignups: number | null };
  const job = db.prepare('SELECT title, description, defaultStartTime, defaultEndTime, defaultMaxSignups FROM jobs WHERE id = ?').get(jobId) as JobRow | undefined;
  if (!job) return;

  const dateKey = packDate(date);
  let eventId = (db.prepare('SELECT id FROM calendar_events WHERE jobId = ? AND date = ?').get(jobId, dateKey) as { id: string } | undefined)?.id;

  if (!eventId) {
    eventId = createId();
    const ts = now();
    db.prepare(
      `INSERT INTO calendar_events (id, title, description, eventType, date, startTime, endTime, maxSignups, jobId, createdById, createdAt, updatedAt)
       VALUES (?,?,?,'HELP_NEEDED',?,?,?,?,?,?,?,?)`,
    ).run(eventId, job.title, job.description, dateKey, job.defaultStartTime, job.defaultEndTime, job.defaultMaxSignups, jobId, actor.id, ts, ts);
  }

  if (job.defaultMaxSignups !== null) {
    const { n } = db.prepare('SELECT COUNT(*) as n FROM event_signups WHERE eventId = ?').get(eventId) as { n: number };
    if (n >= (job.defaultMaxSignups ?? Infinity)) return; // full
  }

  db.prepare('INSERT OR IGNORE INTO event_signups (id, eventId, userId, signedUpAt) VALUES (?,?,?,?)').run(createId(), eventId, actor.id, now());

  await logAudit({
    userId: actor.id,
    action: 'EVENT_SIGNUP',
    resource: 'CalendarEvent',
    resourceId: eventId,
    detail: { jobId, dateStr, source: 'recurring_job_occurrence' },
  });

  revalidatePath('/schedule');
  revalidatePath('/admin/schedule');
}

export async function withdrawFromJobOccurrence(jobId: string, dateStr: string) {
  const actor = await requireAuth();

  const date = parseDate(dateStr);
  if (!date) return;

  const db = getDb();
  const event = db.prepare('SELECT id FROM calendar_events WHERE jobId = ? AND date = ?').get(jobId, packDate(date)) as { id: string } | undefined;
  if (!event) return;

  db.prepare('DELETE FROM event_signups WHERE eventId = ? AND userId = ?').run(event.id, actor.id);

  await logAudit({
    userId: actor.id,
    action: 'EVENT_WITHDRAWAL',
    resource: 'CalendarEvent',
    resourceId: event.id,
  });

  revalidatePath('/schedule');
  revalidatePath('/admin/schedule');
}

// ---------------------------------------------------------------------------
// Volunteer date-slot availability
// ---------------------------------------------------------------------------

export async function saveVolunteerDateSlot(
  dateStr: string,
  startTime: string,
  endTime: string,
  jobIds: string[],
  notes: string,
) {
  const actor = await requireAuth();

  const date = parseDate(dateStr);
  if (!date) return;

  const db = getDb();
  const dateKey = packDate(date);
  const ts = now();
  const existing = db.prepare('SELECT id FROM volunteer_date_slots WHERE userId = ? AND date = ?').get(actor.id, dateKey);
  if (existing) {
    db.prepare('UPDATE volunteer_date_slots SET startTime=?, endTime=?, jobIds=?, notes=?, updatedAt=? WHERE userId=? AND date=?').run(
      startTime.trim() || null, endTime.trim() || null, packJson(jobIds), notes.trim() || null, ts, actor.id, dateKey,
    );
  } else {
    db.prepare('INSERT INTO volunteer_date_slots (id, userId, date, startTime, endTime, jobIds, notes, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)').run(
      createId(), actor.id, dateKey, startTime.trim() || null, endTime.trim() || null, packJson(jobIds), notes.trim() || null, ts, ts,
    );
  }

  revalidatePath('/schedule');
}

export async function deleteVolunteerDateSlot(dateStr: string) {
  const actor = await requireAuth();

  const date = parseDate(dateStr);
  if (!date) return;

  const db = getDb();
  db.prepare('DELETE FROM volunteer_date_slots WHERE userId = ? AND date = ?').run(actor.id, packDate(date));

  revalidatePath('/schedule');
}

// ---------------------------------------------------------------------------
// Admin-on-behalf actions
// ---------------------------------------------------------------------------

async function resolveTargetUser(targetUserId: string) {
  const target = getDb().prepare('SELECT id, name, email FROM users WHERE id = ?').get(targetUserId) as { id: string; name: string | null; email: string } | undefined;
  return target;
}

export async function adminSignupForEventAs(eventId: string, targetUserId: string) {
  const actor = await requireCapability('admin:act-as.write');

  const db = getDb();
  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  const event = db.prepare('SELECT id, maxSignups FROM calendar_events WHERE id = ?').get(eventId) as { id: string; maxSignups: number | null } | undefined;
  if (!event) return;

  if (event.maxSignups !== null) {
    const { n } = db.prepare('SELECT COUNT(*) as n FROM event_signups WHERE eventId = ?').get(eventId) as { n: number };
    if (n >= event.maxSignups) return;
  }

  db.prepare('INSERT OR IGNORE INTO event_signups (id, eventId, userId, signedUpAt) VALUES (?,?,?,?)').run(createId(), eventId, target.id, now());

  await logAudit({
    userId: actor.id,
    action: 'EVENT_SIGNUP',
    resource: 'CalendarEvent',
    resourceId: eventId,
    detail: { onBehalfOf: target.id, onBehalfOfName: target.name ?? target.email },
  });

  revalidatePath('/schedule');
}

export async function adminWithdrawFromEventAs(eventId: string, targetUserId: string) {
  const actor = await requireCapability('admin:act-as.write');

  const db = getDb();
  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  db.prepare('DELETE FROM event_signups WHERE eventId = ? AND userId = ?').run(eventId, target.id);

  await logAudit({
    userId: actor.id,
    action: 'EVENT_WITHDRAWAL',
    resource: 'CalendarEvent',
    resourceId: eventId,
    detail: { onBehalfOf: target.id, onBehalfOfName: target.name ?? target.email },
  });

  revalidatePath('/schedule');
}

export async function adminSignupForJobOccurrenceAs(
  jobId: string,
  dateStr: string,
  targetUserId: string,
) {
  const actor = await requireCapability('admin:act-as.write');

  const db = getDb();
  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  const date = parseDate(dateStr);
  if (!date) return;

  type JobRow = { title: string; description: string | null; defaultStartTime: string | null; defaultEndTime: string | null; defaultMaxSignups: number | null };
  const job = db.prepare('SELECT title, description, defaultStartTime, defaultEndTime, defaultMaxSignups FROM jobs WHERE id = ?').get(jobId) as JobRow | undefined;
  if (!job) return;

  const dateKey = packDate(date);
  let eventId = (db.prepare('SELECT id FROM calendar_events WHERE jobId = ? AND date = ?').get(jobId, dateKey) as { id: string } | undefined)?.id;

  if (!eventId) {
    eventId = createId();
    const ts = now();
    db.prepare(
      `INSERT INTO calendar_events (id, title, description, eventType, date, startTime, endTime, maxSignups, jobId, createdById, createdAt, updatedAt)
       VALUES (?,?,?,'HELP_NEEDED',?,?,?,?,?,?,?,?)`,
    ).run(eventId, job.title, job.description, dateKey, job.defaultStartTime, job.defaultEndTime, job.defaultMaxSignups, jobId, actor.id, ts, ts);
  }

  if (job.defaultMaxSignups !== null) {
    const { n } = db.prepare('SELECT COUNT(*) as n FROM event_signups WHERE eventId = ?').get(eventId) as { n: number };
    if (n >= job.defaultMaxSignups) return;
  }

  db.prepare('INSERT OR IGNORE INTO event_signups (id, eventId, userId, signedUpAt) VALUES (?,?,?,?)').run(createId(), eventId, target.id, now());

  await logAudit({
    userId: actor.id,
    action: 'EVENT_SIGNUP',
    resource: 'CalendarEvent',
    resourceId: eventId,
    detail: { jobId, dateStr, source: 'recurring_job_occurrence', onBehalfOf: target.id, onBehalfOfName: target.name ?? target.email },
  });

  revalidatePath('/schedule');
  revalidatePath('/admin/schedule');
}

export async function adminWithdrawFromJobOccurrenceAs(
  jobId: string,
  dateStr: string,
  targetUserId: string,
) {
  const actor = await requireCapability('admin:act-as.write');

  const db = getDb();
  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  const date = parseDate(dateStr);
  if (!date) return;

  const event = db.prepare('SELECT id FROM calendar_events WHERE jobId = ? AND date = ?').get(jobId, packDate(date)) as { id: string } | undefined;
  if (!event) return;

  db.prepare('DELETE FROM event_signups WHERE eventId = ? AND userId = ?').run(event.id, target.id);

  await logAudit({
    userId: actor.id,
    action: 'EVENT_WITHDRAWAL',
    resource: 'CalendarEvent',
    resourceId: event.id,
    detail: { onBehalfOf: target.id, onBehalfOfName: target.name ?? target.email },
  });

  revalidatePath('/schedule');
  revalidatePath('/admin/schedule');
}

export async function adminSaveVolunteerDateSlotAs(
  targetUserId: string,
  dateStr: string,
  startTime: string,
  endTime: string,
  jobIds: string[],
  notes: string,
) {
  const actor = await requireCapability('admin:act-as.write');

  const db = getDb();
  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  const date = parseDate(dateStr);
  if (!date) return;

  const dateKey = packDate(date);
  const ts = now();
  const existing = db.prepare('SELECT id FROM volunteer_date_slots WHERE userId = ? AND date = ?').get(target.id, dateKey);
  if (existing) {
    db.prepare('UPDATE volunteer_date_slots SET startTime=?, endTime=?, jobIds=?, notes=?, updatedAt=? WHERE userId=? AND date=?').run(
      startTime.trim() || null, endTime.trim() || null, packJson(jobIds), notes.trim() || null, ts, target.id, dateKey,
    );
  } else {
    db.prepare('INSERT INTO volunteer_date_slots (id, userId, date, startTime, endTime, jobIds, notes, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)').run(
      createId(), target.id, dateKey, startTime.trim() || null, endTime.trim() || null, packJson(jobIds), notes.trim() || null, ts, ts,
    );
  }

  await logAudit({
    userId: actor.id,
    action: 'AVAILABILITY_UPDATED',
    resource: 'VolunteerDateSlot',
    resourceId: `${target.id}__${dateStr}`,
    detail: { onBehalfOf: target.id, onBehalfOfName: target.name ?? target.email, dateStr },
  });

  revalidatePath('/schedule');
  revalidatePath('/admin/schedule/availability');
}

export async function adminDeleteVolunteerDateSlotAs(targetUserId: string, dateStr: string) {
  const actor = await requireCapability('admin:act-as.write');

  const db = getDb();
  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  const date = parseDate(dateStr);
  if (!date) return;

  db.prepare('DELETE FROM volunteer_date_slots WHERE userId = ? AND date = ?').run(target.id, packDate(date));

  await logAudit({
    userId: actor.id,
    action: 'AVAILABILITY_DELETED',
    resource: 'VolunteerDateSlot',
    resourceId: `${target.id}__${dateStr}`,
    detail: { onBehalfOf: target.id, onBehalfOfName: target.name ?? target.email, dateStr },
  });

  revalidatePath('/schedule');
  revalidatePath('/admin/schedule/availability');
}
