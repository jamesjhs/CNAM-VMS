/** Calendar grid and date helpers used by the schedule pages. */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const EVENT_TYPE_LABELS = {
  EVENT: 'Event',
  ROSTER: 'Roster slot',
  HELP_NEEDED: 'Help needed',
} as const;

export const EVENT_TYPE_COLOURS = {
  EVENT: '#3b82f6',      // blue-500
  ROSTER: '#8b5cf6',     // violet-500
  HELP_NEEDED: '#f59e0b', // amber-500
} as const;

export const EVENT_TYPE_BG = {
  EVENT: 'bg-blue-100 text-blue-800 border-blue-200',
  ROSTER: 'bg-violet-100 text-violet-800 border-violet-200',
  HELP_NEEDED: 'bg-amber-100 text-amber-800 border-amber-200',
} as const;

export const JOB_COLOURS = [
  { value: '#6366f1', label: 'Indigo', tw: 'bg-indigo-500' },
  { value: '#3b82f6', label: 'Blue', tw: 'bg-blue-500' },
  { value: '#22c55e', label: 'Green', tw: 'bg-green-500' },
  { value: '#f59e0b', label: 'Amber', tw: 'bg-amber-500' },
  { value: '#ef4444', label: 'Red', tw: 'bg-red-500' },
  { value: '#ec4899', label: 'Pink', tw: 'bg-pink-500' },
  { value: '#14b8a6', label: 'Teal', tw: 'bg-teal-500' },
  { value: '#a855f7', label: 'Purple', tw: 'bg-purple-500' },
] as const;

/**
 * Parse a "YYYY-MM" month param string.
 * Returns current month if the param is absent or malformed.
 */
export function parseMonthParam(param?: string): { year: number; month: number } {
  const now = new Date();
  const defaults = { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  if (!param) return defaults;
  const m = param.match(/^(\d{4})-(\d{2})$/);
  if (!m) return defaults;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1; // 0-indexed
  if (month < 0 || month > 11) return defaults;
  return { year, month };
}

/** Format year+month as "YYYY-MM". */
export function fmtMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Return the "YYYY-MM" string for the month before the given one. */
export function prevMonth(year: number, month: number): string {
  return month === 0 ? fmtMonth(year - 1, 11) : fmtMonth(year, month - 1);
}

/** Return the "YYYY-MM" string for the month after the given one. */
export function nextMonth(year: number, month: number): string {
  return month === 11 ? fmtMonth(year + 1, 0) : fmtMonth(year, month + 1);
}

/** Format a Date as "YYYY-MM-DD" using UTC. */
export function dateToParam(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Parse a "YYYY-MM-DD" string into a UTC midnight Date, or null on failure. */
export function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])));
}

/** True if two Dates share the same UTC calendar date. */
export function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Build a calendar grid for the given year/month (both 0-indexed month).
 * Returns an array of weeks; each week is 7 slots (Mon–Sun).
 * Slots outside the month are null.
 */
export function getCalendarWeeks(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  // UK convention: Mon=0 … Sun=6
  // JS getUTCDay(): Sun=0, Mon=1 … Sat=6 → shift by -1 mod 7
  const firstDow = (firstDay.getUTCDay() + 6) % 7;

  const flat: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) flat.push(null);
  for (let d = 1; d <= totalDays; d++) flat.push(new Date(Date.UTC(year, month, d)));
  while (flat.length % 7 !== 0) flat.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

/** First and last DateTime of a month (UTC), suitable for Prisma date-range queries. */
export function monthDateRange(year: number, month: number) {
  return {
    gte: new Date(Date.UTC(year, month, 1)),
    lt: new Date(Date.UTC(year, month + 1, 1)),
  };
}

/** Format a "HH:MM" time string to a display value, e.g. "09:00". */
export function fmtTime(t: string | null | undefined): string {
  return t ?? '';
}
