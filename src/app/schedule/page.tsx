import { requireAuth, hasCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  getCalendarWeeks,
  parseMonthParam,
  fmtMonth,
  prevMonth,
  nextMonth,
  dateToParam,
  isSameDate,
  parseDate,
  MONTH_NAMES,
  DAY_NAMES_SHORT,
  EVENT_TYPE_BG,
  EVENT_TYPE_LABELS,
  monthDateRange,
  getJobOccurrenceDates,
  WEEK_DAY_LABELS,
} from '@/lib/calendar';
import {
  signupForEvent,
  withdrawFromEvent,
  saveVolunteerDateSlot,
  deleteVolunteerDateSlot,
  signupForJobOccurrence,
  withdrawFromJobOccurrence,
  adminSignupForEventAs,
  adminWithdrawFromEventAs,
  adminSignupForJobOccurrenceAs,
  adminWithdrawFromJobOccurrenceAs,
  adminSaveVolunteerDateSlotAs,
  adminDeleteVolunteerDateSlotAs,
} from './actions';

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string; userId?: string }>;
}) {
  const user = await requireAuth();

  const { month: monthParam, day: dayParam, userId: userIdParam } = await searchParams;
  const { year, month } = parseMonthParam(monthParam);
  const currentMonthStr = fmtMonth(year, month);
  const selectedDate = dayParam ? parseDate(dayParam) : null;

  // Admin acting-as: allow admins to view/manage the schedule on behalf of another user
  const isAdmin = hasCapability(user, 'admin:calendar.write');
  const isActingAs = isAdmin && !!userIdParam && userIdParam !== user.id;

  // Load all users for admin picker (only if admin)
  const allUsers = isAdmin
    ? await prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      })
    : [];

  // Resolve the target user (the user whose schedule we are managing)
  const targetUser = isActingAs
    ? await prisma.user.findUnique({
        where: { id: userIdParam },
        select: { id: true, name: true, email: true },
      })
    : null;

  // If the userId param was provided but the user wasn't found, fall back to the admin's own view
  const resolvedIsActingAs = isActingAs && targetUser !== null;

  // The effective user ID for all data queries
  const targetId = targetUser ? targetUser.id : user.id;

  const [events, mySignups, mySlots, allJobs, myUpcomingSignups] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { date: monthDateRange(year, month) },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: {
        job: { select: { id: true, title: true, colour: true } },
        team: { select: { id: true, name: true } },
        _count: { select: { signups: true } },
      },
    }),
    prisma.eventSignup.findMany({
      where: {
        userId: targetId,
        event: { date: monthDateRange(year, month) },
      },
      select: { eventId: true, event: { select: { jobId: true, date: true } } },
    }),
    prisma.volunteerDateSlot.findMany({
      where: {
        userId: targetId,
        date: monthDateRange(year, month),
      },
    }),
    prisma.job.findMany({ orderBy: [{ isRolling: 'desc' }, { title: 'asc' }] }),
    // All future sign-ups (up to next 20, sorted by date)
    prisma.eventSignup.findMany({
      where: {
        userId: targetId,
        event: { date: { gte: new Date() } },
      },
      orderBy: { event: { date: 'asc' } },
      take: 20,
      include: {
        event: {
          include: {
            job: { select: { title: true, colour: true } },
            team: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const mySignupIds = new Set(mySignups.map((s) => s.eventId));

  // Build a set of jobId+dateKey combinations the user is already signed up for
  // (covers both explicit events and auto-created events from recurring jobs)
  const mySignedJobDates = new Set<string>();
  for (const s of mySignups) {
    if (s.event.jobId) {
      mySignedJobDates.add(`${s.event.jobId}__${dateToParam(s.event.date)}`);
    }
  }

  const mySlotsByDate = new Map<string, typeof mySlots[0]>();
  for (const slot of mySlots) {
    mySlotsByDate.set(dateToParam(slot.date), slot);
  }

  // Build a set of (jobId + dateKey) pairs that already have a CalendarEvent
  const existingJobDateKeys = new Set<string>();
  for (const ev of events) {
    if (ev.job) existingJobDateKeys.add(`${ev.job.id}__${dateToParam(ev.date)}`);
  }

  // Compute recurring job occurrences for this month (not already covered by a CalendarEvent)
  const recurringJobs = allJobs.filter((j) => j.scheduleType !== 'ONE_OFF');
  type Occurrence = {
    job: typeof recurringJobs[0];
    date: Date;
    dateKey: string;
  };
  const occurrences: Occurrence[] = [];
  for (const job of recurringJobs) {
    for (const date of getJobOccurrenceDates(job, year, month)) {
      const dk = dateToParam(date);
      if (!existingJobDateKeys.has(`${job.id}__${dk}`)) {
        occurrences.push({ job, date, dateKey: dk });
      }
    }
  }

  const occurrencesByDate = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    if (!occurrencesByDate.has(occ.dateKey)) occurrencesByDate.set(occ.dateKey, []);
    occurrencesByDate.get(occ.dateKey)!.push(occ);
  }

  // Group events by date
  const eventsByDate = new Map<string, typeof events>();
  for (const ev of events) {
    const key = dateToParam(ev.date);
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push(ev);
  }

  const selectedDateKey = selectedDate ? dateToParam(selectedDate) : null;
  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDateKey!) ?? []) : [];
  const selectedOccurrences = selectedDate ? (occurrencesByDate.get(selectedDateKey!) ?? []) : [];
  const mySlotForDay = selectedDateKey ? mySlotsByDate.get(selectedDateKey) : null;

  const today = new Date();
  const weeks = getCalendarWeeks(year, month);

  const rollingJobs = allJobs.filter((j) => j.isRolling);
  const rosteredJobs = allJobs.filter((j) => !j.isRolling);

  function scheduleLabel(job: typeof recurringJobs[0]): string {
    if (job.scheduleType === 'WEEKLY') return 'Every ' + job.weekDays.map((d) => WEEK_DAY_LABELS[d]).join(', ');
    if (job.scheduleType === 'MONTHLY') return job.monthDays.map((d) => `${d}`).join(', ') + ' of month';
    return '';
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">

        {/* Admin: acting-as banner and user picker */}
        {isAdmin && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-amber-800">🛡️ Admin view:</span>
              <form method="GET" action="/schedule" className="flex items-center gap-2 flex-1 min-w-0">
                <input type="hidden" name="month" value={currentMonthStr} />
                <label htmlFor="act-as-user" className="text-sm text-amber-700 shrink-0">
                  Acting as:
                </label>
                <select
                  id="act-as-user"
                  name="userId"
                  defaultValue={targetId}
                  className="flex-1 min-w-0 border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value={user.id}>Myself ({user.name ?? user.email})</option>
                  {allUsers
                    .filter((u) => u.id !== user.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors"
                >
                  Switch
                </button>
              </form>
              {resolvedIsActingAs && targetUser && (
                <Link
                  href={`/schedule?month=${currentMonthStr}`}
                  className="text-xs text-amber-600 hover:text-amber-800 underline shrink-0"
                >
                  Back to my view
                </Link>
              )}
            </div>
            {isActingAs && !targetUser && (
              <p className="mt-2 text-xs text-red-700">
                ⚠️ The selected user could not be found. Showing your own schedule instead.
              </p>
            )}
            {resolvedIsActingAs && targetUser && (
              <p className="mt-2 text-xs text-amber-700">
                ⚠️ You are managing the schedule on behalf of{' '}
                <strong>{targetUser.name ?? targetUser.email}</strong>. All sign-ups and
                availability changes will be applied to their account and logged against yours.
              </p>
            )}
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Schedule &amp; Availability</h1>
          <p className="text-gray-500">
            Browse upcoming events and sign up for shifts. Click any day to record your availability
            and choose what you can help with.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-6 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-100 text-blue-800">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>Event
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-100 text-violet-800">
            <span className="w-2 h-2 rounded-full bg-violet-500"></span>Roster slot
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 text-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>Help needed
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>Recurring job
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 text-green-800">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>My availability
          </span>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <Link
              href={`/schedule?month=${prevMonth(year, month)}${resolvedIsActingAs && targetUser ? `&userId=${targetUser.id}` : ''}`}
              className="text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              ← Previous
            </Link>
            <h2 className="font-semibold text-gray-900">{MONTH_NAMES[month]} {year}</h2>
            <Link
              href={`/schedule?month=${nextMonth(year, month)}${resolvedIsActingAs && targetUser ? `&userId=${targetUser.id}` : ''}`}
              className="text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Next →
            </Link>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAY_NAMES_SHORT.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>

          <div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={di} className="min-h-[52px] sm:min-h-[80px] bg-gray-50/50 border-r border-gray-50 last:border-r-0" />;
                  }
                  const dayKey = dateToParam(day);
                  const dayEvents = eventsByDate.get(dayKey) ?? [];
                  const dayOccs = occurrencesByDate.get(dayKey) ?? [];
                  const hasMySlot = mySlotsByDate.has(dayKey);
                  const isToday = isSameDate(day, today);
                  const isSelected = selectedDate ? isSameDate(day, selectedDate) : false;
                  const totalItems = dayEvents.length + dayOccs.length;

                  return (
                    <Link
                      key={di}
                      href={`/schedule?month=${currentMonthStr}&day=${dayKey}${resolvedIsActingAs && targetUser ? `&userId=${targetUser.id}` : ''}`}
                      className={`min-h-[52px] sm:min-h-[80px] p-1 sm:p-2 border-r border-gray-50 last:border-r-0 hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''
                      }`}
                    >
                      <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-xs font-medium rounded-full ${
                            isToday
                              ? 'bg-[#1a3a5c] text-white'
                              : isSelected
                              ? 'bg-blue-200 text-blue-900'
                              : 'text-gray-700'
                          }`}
                        >
                          {day.getUTCDate()}
                        </span>
                        {hasMySlot && (
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-400 shrink-0" title="My availability recorded" />
                        )}
                      </div>
                      {/* Event indicators: dots on mobile, labels on sm+ */}
                      {totalItems > 0 && (
                        <>
                          <div className="sm:hidden flex flex-wrap gap-0.5 mt-0.5">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <span key={ev.id} className={`w-1.5 h-1.5 rounded-full ${mySignupIds.has(ev.id) ? 'bg-green-500' : 'bg-blue-400'}`} />
                            ))}
                            {dayOccs.slice(0, Math.max(0, 3 - dayEvents.length)).map((occ) => (
                              <span key={`${occ.job.id}__${occ.dateKey}`} className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            ))}
                            {totalItems > 3 && <span className="text-[8px] text-gray-400">+{totalItems - 3}</span>}
                          </div>
                          <div className="hidden sm:block space-y-0.5">
                            {dayEvents.slice(0, 2).map((ev) => (
                              <div
                                key={ev.id}
                                className={`text-xs px-1 py-0.5 rounded truncate border ${EVENT_TYPE_BG[ev.eventType]}`}
                              >
                                {mySignupIds.has(ev.id) && <span className="mr-0.5">✓</span>}
                                {ev.title}
                              </div>
                            ))}
                            {dayOccs.slice(0, Math.max(0, 2 - dayEvents.length)).map((occ) => {
                              const key = `${occ.job.id}__${occ.dateKey}`;
                              return (
                                <div
                                  key={key}
                                  className="text-xs px-1 py-0.5 rounded truncate border border-dashed bg-gray-50 text-gray-600 border-gray-300"
                                >
                                  {mySignedJobDates.has(key) && <span className="mr-0.5">✓</span>}
                                  🔁 {occ.job.title}
                                </div>
                              );
                            })}
                            {totalItems > 2 && (
                              <div className="text-xs text-gray-400">+{totalItems - 2} more</div>
                            )}
                          </div>
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Day detail modal overlay ──────────────────────────────────────── */}
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <Link
              href={`/schedule?month=${currentMonthStr}${resolvedIsActingAs && targetUser ? `&userId=${targetUser.id}` : ''}`}
              aria-label="Close"
              className="absolute inset-0 bg-black/50"
            />
            {/* Modal panel */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 sticky top-0 rounded-t-xl">
              <h3 className="font-semibold text-gray-900">
                {selectedDate.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
                {resolvedIsActingAs && targetUser && (
                  <span className="ml-2 text-sm font-normal text-amber-600">
                    — acting as {targetUser.name ?? targetUser.email}
                  </span>
                )}
              </h3>
              <Link
                href={`/schedule?month=${currentMonthStr}${resolvedIsActingAs && targetUser ? `&userId=${targetUser.id}` : ''}`}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
            </div>

            {/* ── Section 1: Scheduled events ──────────────────────────────── */}
            <div className="px-6 py-5 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Scheduled Events &amp; Requests
              </h4>
              {selectedEvents.length === 0 && selectedOccurrences.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  No events scheduled for this day — but you can still record your availability below.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Explicit CalendarEvents */}
                  {selectedEvents.map((ev) => {
                    const isSignedUp = mySignupIds.has(ev.id);
                    const isFull =
                      ev.maxSignups !== null && ev._count.signups >= ev.maxSignups && !isSignedUp;

                    return (
                      <div
                        key={ev.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          isSignedUp ? 'border-green-200 bg-green-50' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${EVENT_TYPE_BG[ev.eventType]}`}>
                                {EVENT_TYPE_LABELS[ev.eventType]}
                              </span>
                              {ev.team && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                  🏷️ {ev.team.name}
                                </span>
                              )}
                              {ev.job && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white"
                                  style={{ backgroundColor: ev.job.colour }}
                                >
                                  {ev.job.title}
                                </span>
                              )}
                              {isSignedUp && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  ✓ Signed up
                                </span>
                              )}
                            </div>
                            <div className="font-medium text-gray-900 text-sm">{ev.title}</div>
                            {ev.description && (
                              <div className="text-xs text-gray-500 mt-0.5">{ev.description}</div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              {ev.startTime && `${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''} · `}
                              {ev._count.signups} signed up
                              {ev.maxSignups ? ` of ${ev.maxSignups}` : ''}
                              {isFull && <span className="text-red-500 ml-1">· Full</span>}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isSignedUp ? (
                              <form action={resolvedIsActingAs && targetUser ? adminWithdrawFromEventAs.bind(null, ev.id, targetUser.id) : withdrawFromEvent.bind(null, ev.id)}>
                                <button
                                  type="submit"
                                  className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-2 rounded-lg border border-red-100 hover:bg-red-50 transition-colors whitespace-nowrap"
                                >
                                  Withdraw
                                </button>
                              </form>
                            ) : (
                              <form action={resolvedIsActingAs && targetUser ? adminSignupForEventAs.bind(null, ev.id, targetUser.id) : signupForEvent.bind(null, ev.id)}>
                                <button
                                  type="submit"
                                  disabled={isFull}
                                  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                                    isFull
                                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                                      : 'text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50'
                                  }`}
                                >
                                  {isFull ? 'Full' : 'Sign up'}
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Recurring job occurrences */}
                  {selectedOccurrences.map((occ) => {
                    const key = `${occ.job.id}__${occ.dateKey}`;
                    const isSignedUp = mySignedJobDates.has(key);

                    return (
                      <div
                        key={key}
                        className={`p-4 rounded-lg border transition-colors ${
                          isSignedUp ? 'border-green-200 bg-green-50' : 'border-dashed border-gray-300 bg-gray-50 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-dashed border-gray-300">
                                🔁 Recurring Job
                              </span>
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white"
                                style={{ backgroundColor: occ.job.colour }}
                              >
                                {occ.job.title}
                              </span>
                              {isSignedUp && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  ✓ Signed up
                                </span>
                              )}
                            </div>
                            <div className="font-medium text-gray-900 text-sm">{occ.job.title}</div>
                            {occ.job.description && (
                              <div className="text-xs text-gray-500 mt-0.5">{occ.job.description}</div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              {scheduleLabel(occ.job)}
                              {(occ.job.defaultStartTime || occ.job.defaultEndTime) &&
                                ` · ${occ.job.defaultStartTime ?? ''}${occ.job.defaultEndTime ? `–${occ.job.defaultEndTime}` : ''}`}
                              {occ.job.defaultMaxSignups && ` · Max ${occ.job.defaultMaxSignups} volunteers`}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isSignedUp ? (
                              <form action={resolvedIsActingAs && targetUser ? adminWithdrawFromJobOccurrenceAs.bind(null, occ.job.id, occ.dateKey, targetUser.id) : withdrawFromJobOccurrence.bind(null, occ.job.id, occ.dateKey)}>
                                <button
                                  type="submit"
                                  className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-2 rounded-lg border border-red-100 hover:bg-red-50 transition-colors whitespace-nowrap"
                                >
                                  Withdraw
                                </button>
                              </form>
                            ) : (
                              <form action={resolvedIsActingAs && targetUser ? adminSignupForJobOccurrenceAs.bind(null, occ.job.id, occ.dateKey, targetUser.id) : signupForJobOccurrence.bind(null, occ.job.id, occ.dateKey)}>
                                <button
                                  type="submit"
                                  className="text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50"
                                >
                                  Sign up
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Section 2: Availability for this day ───────────────────── */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {resolvedIsActingAs && targetUser
                    ? `${targetUser.name ?? targetUser.email}'s Availability on This Day`
                    : 'My Availability on This Day'}
                </h4>
                {mySlotForDay && (
                  <form action={resolvedIsActingAs && targetUser ? adminDeleteVolunteerDateSlotAs.bind(null, targetUser.id, selectedDateKey!) : deleteVolunteerDateSlot.bind(null, selectedDateKey!)}>
                    <button
                      type="submit"
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Remove availability
                    </button>
                  </form>
                )}
              </div>

              {mySlotForDay && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>
                    {resolvedIsActingAs && targetUser ? `${targetUser.name ?? targetUser.email} has` : 'You have'} recorded availability for this day
                    {mySlotForDay.startTime || mySlotForDay.endTime
                      ? `: ${mySlotForDay.startTime ?? ''}${mySlotForDay.endTime ? `–${mySlotForDay.endTime}` : ''}`
                      : ' (all day)'}.
                    {' '}Update using the form below.
                  </span>
                </div>
              )}

              <form
                action={async (formData: FormData) => {
                  'use server';
                  const dateStr = formData.get('date') as string;
                  const startTime = formData.get('startTime') as string;
                  const endTime = formData.get('endTime') as string;
                  const notes = formData.get('notes') as string;
                  const jobIds = allJobs
                    .map((j) => j.id)
                    .filter((id) => formData.get(`job_${id}`) === 'on');
                  if (resolvedIsActingAs && targetUser) {
                    await adminSaveVolunteerDateSlotAs(targetUser.id, dateStr, startTime, endTime, jobIds, notes);
                  } else {
                    await saveVolunteerDateSlot(dateStr, startTime, endTime, jobIds, notes);
                  }
                }}
                className="space-y-5"
              >
                <input type="hidden" name="date" value={selectedDateKey!} />

                {/* Time */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">What time are you available?</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">From</label>
                      <input
                        name="startTime"
                        type="time"
                        defaultValue={mySlotForDay?.startTime ?? ''}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-gray-400 text-sm mt-4">–</span>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">Until</label>
                      <input
                        name="endTime"
                        type="time"
                        defaultValue={mySlotForDay?.endTime ?? ''}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Rolling duties */}
                {rollingJobs.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      General duties I can help with on this day:
                    </p>
                    <p className="text-xs text-gray-400 mb-3">
                      These happen regularly at the museum and any extra hands are always welcome.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rollingJobs.map((job) => (
                        <label key={job.id} className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${mySlotForDay?.jobIds.includes(job.id)
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}>
                          <input
                            type="checkbox"
                            name={`job_${job.id}`}
                            defaultChecked={mySlotForDay?.jobIds.includes(job.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: job.colour }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{job.title}</div>
                            {job.description && (
                              <div className="text-xs text-gray-500 truncate">{job.description}</div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rostered roles */}
                {rosteredJobs.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Rostered roles I&apos;m willing to be assigned to:
                    </p>
                    <p className="text-xs text-gray-400 mb-3">
                      These roles are organised by administrators for specific events.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rosteredJobs.map((job) => (
                        <label key={job.id} className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${mySlotForDay?.jobIds.includes(job.id)
                            ? 'border-violet-200 bg-violet-50'
                            : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}>
                          <input
                            type="checkbox"
                            name={`job_${job.id}`}
                            defaultChecked={mySlotForDay?.jobIds.includes(job.id)}
                            className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: job.colour }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{job.title}</div>
                            {job.description && (
                              <div className="text-xs text-gray-500 truncate">{job.description}</div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plans / notes for the day */}
                <div>
                  <label htmlFor="availability-notes" className="block text-xs font-medium text-gray-500 mb-1">
                    What are you planning to do? <span className="text-gray-400 font-normal">(optional — visible to admins)</span>
                  </label>
                  <textarea
                    id="availability-notes"
                    name="notes"
                    rows={3}
                    defaultValue={mySlotForDay?.notes ?? ''}
                    placeholder="e.g. helping with the tearoom in the morning, or anything else you'd like the team to know"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {mySlotForDay
                    ? (resolvedIsActingAs && targetUser ? `✓ Update ${targetUser.name ?? targetUser.email}'s Availability` : '✓ Update My Availability')
                    : (resolvedIsActingAs && targetUser ? `Save ${targetUser.name ?? targetUser.email}'s Availability for This Day` : 'Save My Availability for This Day')}
                </button>
              </form>
            </div>
            </div>
          </div>
        )}

        {!selectedDate && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 text-sm text-blue-700">
            👆 Click on any day in the calendar to sign up for events and record what you can help with on that day.
          </div>
        )}

        {/* General duties info */}
        {rollingJobs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-1">General Volunteering Duties</h3>
            <p className="text-sm text-gray-500 mb-4">
              These activities happen regularly at the museum and always benefit from extra volunteers.
              Click any day on the calendar above to indicate you can help — no specific event needed.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rollingJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50"
                >
                  <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: job.colour }} />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{job.title}</div>
                    {job.description && <div className="text-xs text-gray-500 mt-0.5">{job.description}</div>}
                    {job.scheduleType !== 'ONE_OFF' && (
                      <div className="text-xs text-blue-600 mt-0.5">🔁 Recurring: {scheduleLabel(job)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming sign-ups */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-1">
            {resolvedIsActingAs && targetUser ? `${targetUser.name ?? targetUser.email}'s Upcoming Sign-ups` : 'My Upcoming Sign-ups'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {resolvedIsActingAs && targetUser
              ? `All events ${targetUser.name ?? targetUser.email} is signed up for in the coming days.`
              : 'All events you are signed up for in the coming days.'}
          </p>
          {myUpcomingSignups.length === 0 ? (
            <p className="text-gray-400 text-sm">
              {resolvedIsActingAs && targetUser
                ? `${targetUser.name ?? targetUser.email} hasn't signed up for any upcoming events yet.`
                : "You haven't signed up for any upcoming events yet. Browse the calendar above to find events and sign up."}
            </p>
          ) : (
            <div className="space-y-2">
              {myUpcomingSignups.map((signup) => (
                <Link
                  key={signup.id}
                  href={`/schedule?month=${fmtMonth(signup.event.date.getUTCFullYear(), signup.event.date.getUTCMonth())}&day=${dateToParam(signup.event.date)}${resolvedIsActingAs && targetUser ? `&userId=${targetUser.id}` : ''}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-center w-10 shrink-0">
                    <div className="text-lg font-bold text-[#1a3a5c] leading-none">
                      {signup.event.date.getUTCDate()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {signup.event.date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${EVENT_TYPE_BG[signup.event.eventType]}`}>
                        {EVENT_TYPE_LABELS[signup.event.eventType]}
                      </span>
                      {signup.event.team && (
                        <span className="text-xs text-gray-500">🏷️ {signup.event.team.name}</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900 truncate">{signup.event.title}</div>
                    {signup.event.startTime && (
                      <div className="text-xs text-gray-400">
                        {signup.event.startTime}{signup.event.endTime ? `–${signup.event.endTime}` : ''}
                        {signup.event.job && ` · ${signup.event.job.title}`}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {signup.event.date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
