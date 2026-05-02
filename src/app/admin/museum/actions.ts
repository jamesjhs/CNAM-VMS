'use server';

import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now, packDate } from '@/lib/db';
import { requireCapability } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import { parseDate } from '@/lib/calendar';

// ─── Museum Status (Daily announcements) ────────────────────────────────────

export async function createMuseumStatus(date: string, title: string, description: string | null) {
  const actor = await requireCapability('admin:museum.write');
  const db = getDb();

  const parsedDate = parseDate(date);
  if (!parsedDate) return;

  const dateKey = packDate(parsedDate);
  const id = createId();
  const ts = now();

  db.prepare(
    `INSERT OR REPLACE INTO museum_status (id, date, title, description, createdById, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?)`,
  ).run(id, dateKey, title.trim(), description?.trim() ?? null, actor.id, ts, ts);

  await logAudit({
    userId: actor.id,
    action: 'MUSEUM_STATUS_CREATED',
    resource: 'MuseumStatus',
    resourceId: dateKey,
    detail: { date: dateKey, title },
  });

  revalidatePath('/admin/museum');
  revalidatePath('/schedule');
}

export async function deleteMuseumStatus(date: string) {
  const actor = await requireCapability('admin:museum.write');
  const db = getDb();

  db.prepare('DELETE FROM museum_status WHERE date = ?').run(date);

  await logAudit({
    userId: actor.id,
    action: 'MUSEUM_STATUS_DELETED',
    resource: 'MuseumStatus',
    resourceId: date,
  });

  revalidatePath('/admin/museum');
  revalidatePath('/schedule');
}

// ─── Opening Hours (Date ranges) ────────────────────────────────────────────

export async function createOpeningHours(
  startDate: string,
  endDate: string,
  status: string,
  notes: string | null,
) {
  const actor = await requireCapability('admin:museum.write');
  const db = getDb();

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return;

  const id = createId();
  const ts = now();
  const startKey = packDate(start);
  const endKey = packDate(end);

  db.prepare(
    `INSERT INTO museum_opening_hours (id, startDate, endDate, status, notes, createdById, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(id, startKey, endKey, status.trim(), notes?.trim() ?? null, actor.id, ts, ts);

  await logAudit({
    userId: actor.id,
    action: 'OPENING_HOURS_CREATED',
    resource: 'MuseumOpeningHours',
    resourceId: id,
    detail: { startDate: startKey, endDate: endKey, status },
  });

  revalidatePath('/admin/museum');
  revalidatePath('/schedule');
}

export async function updateOpeningHours(
  id: string,
  startDate: string,
  endDate: string,
  status: string,
  notes: string | null,
) {
  const actor = await requireCapability('admin:museum.write');
  const db = getDb();

  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return;

  const ts = now();
  const startKey = packDate(start);
  const endKey = packDate(end);

  db.prepare(
    `UPDATE museum_opening_hours SET startDate=?, endDate=?, status=?, notes=?, updatedAt=? WHERE id=?`,
  ).run(startKey, endKey, status.trim(), notes?.trim() ?? null, ts, id);

  await logAudit({
    userId: actor.id,
    action: 'OPENING_HOURS_UPDATED',
    resource: 'MuseumOpeningHours',
    resourceId: id,
    detail: { startDate: startKey, endDate: endKey, status },
  });

  revalidatePath('/admin/museum');
  revalidatePath('/schedule');
}

export async function deleteOpeningHours(id: string) {
  const actor = await requireCapability('admin:museum.write');
  const db = getDb();

  db.prepare('DELETE FROM museum_opening_hours WHERE id = ?').run(id);

  await logAudit({
    userId: actor.id,
    action: 'OPENING_HOURS_DELETED',
    resource: 'MuseumOpeningHours',
    resourceId: id,
  });

  revalidatePath('/admin/museum');
  revalidatePath('/schedule');
}

// ─── Bank Holidays ─────────────────────────────────────────────────────────

export async function createBankHoliday(date: string, name: string) {
  const actor = await requireCapability('admin:museum.write');
  const db = getDb();

  const parsedDate = parseDate(date);
  if (!parsedDate) return;

  const dateKey = packDate(parsedDate);
  const id = createId();
  const ts = now();

  db.prepare(
    `INSERT OR REPLACE INTO bank_holidays (id, date, name, createdById, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?)`,
  ).run(id, dateKey, name.trim(), actor.id, ts, ts);

  await logAudit({
    userId: actor.id,
    action: 'BANK_HOLIDAY_CREATED',
    resource: 'BankHoliday',
    resourceId: dateKey,
    detail: { date: dateKey, name },
  });

  revalidatePath('/admin/museum');
  revalidatePath('/schedule');
}

export async function updateBankHoliday(date: string, name: string) {
  const actor = await requireCapability('admin:museum.write');
  const db = getDb();

  const ts = now();

  db.prepare('UPDATE bank_holidays SET name=?, updatedAt=? WHERE date=?').run(name.trim(), ts, date);

  await logAudit({
    userId: actor.id,
    action: 'BANK_HOLIDAY_UPDATED',
    resource: 'BankHoliday',
    resourceId: date,
    detail: { date, name },
  });

  revalidatePath('/admin/museum');
  revalidatePath('/schedule');
}

export async function deleteBankHoliday(date: string) {
  const actor = await requireCapability('admin:museum.write');
  const db = getDb();

  db.prepare('DELETE FROM bank_holidays WHERE date = ?').run(date);

  await logAudit({
    userId: actor.id,
    action: 'BANK_HOLIDAY_DELETED',
    resource: 'BankHoliday',
    resourceId: date,
  });

  revalidatePath('/admin/museum');
  revalidatePath('/schedule');
}
