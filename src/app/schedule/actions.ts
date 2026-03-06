'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
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
