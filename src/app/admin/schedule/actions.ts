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
  teamId: string,
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
      teamId: teamId || null,
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

  const job = await prisma.job.create({
    data: {
      title: trimmedTitle,
      description: description.trim() || null,
      isRolling,
      colour: colour || '#6366f1',
      scheduleType: (scheduleType as 'ONE_OFF' | 'WEEKLY' | 'MONTHLY') || 'ONE_OFF',
      weekDays,
      monthDays,
      defaultStartTime: defaultStartTime.trim() || null,
      defaultEndTime: defaultEndTime.trim() || null,
      defaultMaxSignups: defaultMaxSignupsStr ? parseInt(defaultMaxSignupsStr, 10) : null,
    },
  });

  await logAudit({
    userId: actor.id,
    action: 'JOB_CREATED',
    resource: 'Job',
    resourceId: job.id,
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

  await prisma.job.update({
    where: { id: jobId },
    data: {
      title: trimmedTitle,
      description: description.trim() || null,
      isRolling,
      colour: colour || '#6366f1',
      scheduleType: (scheduleType as 'ONE_OFF' | 'WEEKLY' | 'MONTHLY') || 'ONE_OFF',
      weekDays,
      monthDays,
      defaultStartTime: defaultStartTime.trim() || null,
      defaultEndTime: defaultEndTime.trim() || null,
      defaultMaxSignups: defaultMaxSignupsStr ? parseInt(defaultMaxSignupsStr, 10) : null,
    },
  });

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

// ---------------------------------------------------------------------------
// Recurring job occurrence — find or create a CalendarEvent for a specific
// job+date, then create an EventSignup for the current user.
// ---------------------------------------------------------------------------

export async function adminSignupForJobOccurrence(jobId: string, dateStr: string) {
  const actor = await requireCapability('admin:calendar.write');

  const date = parseDate(dateStr);
  if (!date) return;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  let event = await prisma.calendarEvent.findFirst({ where: { jobId, date } });

  if (!event) {
    event = await prisma.calendarEvent.create({
      data: {
        title: job.title,
        description: job.description,
        eventType: 'HELP_NEEDED',
        date,
        startTime: job.defaultStartTime,
        endTime: job.defaultEndTime,
        maxSignups: job.defaultMaxSignups,
        jobId,
        createdById: actor.id,
      },
    });
  }

  await prisma.eventSignup.upsert({
    where: { eventId_userId: { eventId: event.id, userId: actor.id } },
    update: {},
    create: { eventId: event.id, userId: actor.id },
  });

  await logAudit({
    userId: actor.id,
    action: 'EVENT_SIGNUP',
    resource: 'CalendarEvent',
    resourceId: event.id,
  });

  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
}
