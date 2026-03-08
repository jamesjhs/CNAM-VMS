'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import { parseDate } from '@/lib/calendar';

// ---------------------------------------------------------------------------
// Event sign-up / withdrawal
// ---------------------------------------------------------------------------

export async function signupForEvent(eventId: string) {
  const actor = await requireAuth();

  // Verify the event exists and has capacity
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: { _count: { select: { signups: true } } },
  });
  if (!event) return;

  if (event.maxSignups !== null && event._count.signups >= event.maxSignups) {
    // Silently ignore if fully booked (UI should prevent this but just in case)
    return;
  }

  await prisma.eventSignup.upsert({
    where: { eventId_userId: { eventId, userId: actor.id } },
    update: {},
    create: { eventId, userId: actor.id },
  });

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

  await prisma.eventSignup.deleteMany({
    where: { eventId, userId: actor.id },
  });

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
// A CalendarEvent is lazily created on first sign-up so the existing
// EventSignup model can be reused for tracking.
// ---------------------------------------------------------------------------

export async function signupForJobOccurrence(jobId: string, dateStr: string) {
  const actor = await requireAuth();

  const date = parseDate(dateStr);
  if (!date) return;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  // Find or auto-create the CalendarEvent for this job on this date
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

  if (event.maxSignups !== null) {
    const count = await prisma.eventSignup.count({ where: { eventId: event.id } });
    if (count >= event.maxSignups) return; // full
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
    detail: { jobId, dateStr, source: 'recurring_job_occurrence' },
  });

  revalidatePath('/schedule');
  revalidatePath('/admin/schedule');
}

export async function withdrawFromJobOccurrence(jobId: string, dateStr: string) {
  const actor = await requireAuth();

  const date = parseDate(dateStr);
  if (!date) return;

  const event = await prisma.calendarEvent.findFirst({ where: { jobId, date } });
  if (!event) return;

  await prisma.eventSignup.deleteMany({
    where: { eventId: event.id, userId: actor.id },
  });

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

  await prisma.volunteerDateSlot.upsert({
    where: { userId_date: { userId: actor.id, date } },
    update: {
      startTime: startTime.trim() || null,
      endTime: endTime.trim() || null,
      jobIds,
      notes: notes.trim() || null,
    },
    create: {
      userId: actor.id,
      date,
      startTime: startTime.trim() || null,
      endTime: endTime.trim() || null,
      jobIds,
      notes: notes.trim() || null,
    },
  });

  revalidatePath('/schedule');
}

export async function deleteVolunteerDateSlot(dateStr: string) {
  const actor = await requireAuth();

  const date = parseDate(dateStr);
  if (!date) return;

  await prisma.volunteerDateSlot.deleteMany({
    where: { userId: actor.id, date },
  });

  revalidatePath('/schedule');
}

// ---------------------------------------------------------------------------
// Admin-on-behalf actions
// Allow an admin to perform schedule actions on behalf of another user.
// ---------------------------------------------------------------------------

async function resolveTargetUser(targetUserId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true },
  });
  return target;
}

export async function adminSignupForEventAs(eventId: string, targetUserId: string) {
  const actor = await requireCapability('admin:calendar.write');

  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: { _count: { select: { signups: true } } },
  });
  if (!event) return;

  if (event.maxSignups !== null && event._count.signups >= event.maxSignups) return;

  await prisma.eventSignup.upsert({
    where: { eventId_userId: { eventId, userId: target.id } },
    update: {},
    create: { eventId, userId: target.id },
  });

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
  const actor = await requireCapability('admin:calendar.write');

  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  await prisma.eventSignup.deleteMany({
    where: { eventId, userId: target.id },
  });

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
  const actor = await requireCapability('admin:calendar.write');

  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

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

  if (event.maxSignups !== null) {
    const count = await prisma.eventSignup.count({ where: { eventId: event.id } });
    if (count >= event.maxSignups) return;
  }

  await prisma.eventSignup.upsert({
    where: { eventId_userId: { eventId: event.id, userId: target.id } },
    update: {},
    create: { eventId: event.id, userId: target.id },
  });

  await logAudit({
    userId: actor.id,
    action: 'EVENT_SIGNUP',
    resource: 'CalendarEvent',
    resourceId: event.id,
    detail: {
      jobId,
      dateStr,
      source: 'recurring_job_occurrence',
      onBehalfOf: target.id,
      onBehalfOfName: target.name ?? target.email,
    },
  });

  revalidatePath('/schedule');
  revalidatePath('/admin/schedule');
}

export async function adminWithdrawFromJobOccurrenceAs(
  jobId: string,
  dateStr: string,
  targetUserId: string,
) {
  const actor = await requireCapability('admin:calendar.write');

  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  const date = parseDate(dateStr);
  if (!date) return;

  const event = await prisma.calendarEvent.findFirst({ where: { jobId, date } });
  if (!event) return;

  await prisma.eventSignup.deleteMany({
    where: { eventId: event.id, userId: target.id },
  });

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
  const actor = await requireCapability('admin:calendar.write');

  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  const date = parseDate(dateStr);
  if (!date) return;

  await prisma.volunteerDateSlot.upsert({
    where: { userId_date: { userId: target.id, date } },
    update: {
      startTime: startTime.trim() || null,
      endTime: endTime.trim() || null,
      jobIds,
      notes: notes.trim() || null,
    },
    create: {
      userId: target.id,
      date,
      startTime: startTime.trim() || null,
      endTime: endTime.trim() || null,
      jobIds,
      notes: notes.trim() || null,
    },
  });

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
  const actor = await requireCapability('admin:calendar.write');

  const target = await resolveTargetUser(targetUserId);
  if (!target) return;

  const date = parseDate(dateStr);
  if (!date) return;

  await prisma.volunteerDateSlot.deleteMany({
    where: { userId: target.id, date },
  });

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
