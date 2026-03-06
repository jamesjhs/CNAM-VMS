'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import type { CalendarEventType } from '@prisma/client';
import { parseDate } from '@/lib/calendar';

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
) {
  const actor = await requireCapability('admin:calendar.write');

  const trimmedTitle = title.trim();
  if (!trimmedTitle || !dateStr) return;

  const date = parseDate(dateStr);
  if (!date) return;

  const event = await prisma.calendarEvent.create({
    data: {
      title: trimmedTitle,
      description: description.trim() || null,
      eventType,
      date,
      startTime: startTime.trim() || null,
      endTime: endTime.trim() || null,
      jobId: jobId || null,
      maxSignups: maxSignupsStr ? parseInt(maxSignupsStr, 10) : null,
      createdById: actor.id,
    },
  });

  await logAudit({
    userId: actor.id,
    action: 'CALENDAR_EVENT_CREATED',
    resource: 'CalendarEvent',
    resourceId: event.id,
    detail: { title: trimmedTitle, date: dateStr, eventType },
  });

  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
}

export async function deleteCalendarEvent(eventId: string) {
  const actor = await requireCapability('admin:calendar.write');

  await prisma.calendarEvent.delete({ where: { id: eventId } });

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
) {
  const actor = await requireCapability('admin:calendar.write');

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const job = await prisma.job.create({
    data: {
      title: trimmedTitle,
      description: description.trim() || null,
      isRolling,
      colour: colour || '#6366f1',
    },
  });

  await logAudit({
    userId: actor.id,
    action: 'JOB_CREATED',
    resource: 'Job',
    resourceId: job.id,
    detail: { title: trimmedTitle, isRolling },
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
) {
  const actor = await requireCapability('admin:calendar.write');

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  await prisma.job.update({
    where: { id: jobId },
    data: {
      title: trimmedTitle,
      description: description.trim() || null,
      isRolling,
      colour: colour || '#6366f1',
    },
  });

  await logAudit({
    userId: actor.id,
    action: 'JOB_UPDATED',
    resource: 'Job',
    resourceId: jobId,
    detail: { title: trimmedTitle, isRolling },
  });

  revalidatePath('/admin/schedule/jobs');
  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
}

export async function deleteJob(jobId: string) {
  const actor = await requireCapability('admin:calendar.write');

  await prisma.job.delete({ where: { id: jobId } });

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
