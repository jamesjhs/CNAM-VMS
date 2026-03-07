import { requireCapability } from '@/lib/auth-helpers';
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
import { createCalendarEvent, deleteCalendarEvent } from './actions';
import type { CalendarEventType } from '@prisma/client';

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  await requireCapability('admin:calendar.write');

  const { month: monthParam, day: dayParam } = await searchParams;
  const { year, month } = parseMonthParam(monthParam);
  const currentMonthStr = fmtMonth(year, month);
  const selectedDate = dayParam ? parseDate(dayParam) : null;

  const [events, teams, jobs] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { date: monthDateRange(year, month) },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: {
        job: { select: { id: true, title: true, colour: true } },
        team: { select: { id: true, name: true } },
        signups: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { signedUpAt: 'asc' },
        },
      },
    }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
    prisma.job.findMany({ orderBy: { title: 'asc' } }),
  ]);

  // Build a set of (jobId + dateKey) pairs that already have a CalendarEvent
  const existingJobDateKeys = new Set<string>();
  for (const ev of events) {
    if (ev.job) existingJobDateKeys.add(`${ev.job.id}__${dateToParam(ev.date)}`);
  }

  // Compute recurring job occurrences for this month that don't already have an event
  const recurringJobs = jobs.filter((j) => j.scheduleType !== 'ONE_OFF');
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

  // Group occurrences by date
  const occurrencesByDate = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    if (!occurrencesByDate.has(occ.dateKey)) occurrencesByDate.set(occ.dateKey, []);
    occurrencesByDate.get(occ.dateKey)!.push(occ);
  }

  const weeks = getCalendarWeeks(year, month);
  const today = new Date();

  const eventsByDate = new Map<string, typeof events>();
  for (const ev of events) {
    const key = dateToParam(ev.date);
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push(ev);
  }

  const selectedDateKey = selectedDate ? dateToParam(selectedDate) : null;
  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDateKey!) ?? []) : [];
  const selectedOccurrences = selectedDate ? (occurrencesByDate.get(selectedDateKey!) ?? []) : [];

  function scheduleLabel(job: typeof recurringJobs[0]): string {
    if (job.scheduleType === 'WEEKLY') return 'Every ' + job.weekDays.map((d) => WEEK_DAY_LABELS[d]).join(', ');
    if (job.scheduleType === 'MONTHLY') return job.monthDays.map((d) => `${d}`).join(', ') + ' of month';
    return '';
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Schedule</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Schedule Management</h1>
            <p className="text-gray-500">Create and manage events, roster slots, and help requests. Recurring jobs appear automatically.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/schedule/availability"
              className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Volunteer Availability →
            </Link>
            <Link
              href="/admin/schedule/jobs"
              className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Manage Jobs →
            </Link>
          </div>
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
            <span className="w-2 h-2 rounded-full bg-gray-400 border border-dashed border-gray-400"></span>Recurring job
          </span>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <Link
              href={`/admin/schedule?month=${prevMonth(year, month)}`}
              className="text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              ← Previous
            </Link>
            <h2 className="font-semibold text-gray-900">{MONTH_NAMES[month]} {year}</h2>
            <Link
              href={`/admin/schedule?month=${nextMonth(year, month)}`}
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
                  if (!day) return <div key={di} className="min-h-[52px] sm:min-h-[80px] bg-gray-50/50 border-r border-gray-50 last:border-r-0" />;
                  const dayKey = dateToParam(day);
                  const dayEvents = eventsByDate.get(dayKey) ?? [];
                  const dayOccs = occurrencesByDate.get(dayKey) ?? [];
                  const isToday = isSameDate(day, today);
                  const isSelected = selectedDate ? isSameDate(day, selectedDate) : false;
                  const totalItems = dayEvents.length + dayOccs.length;

                  return (
                    <Link
                      key={di}
                      href={`/admin/schedule?month=${currentMonthStr}&day=${dayKey}`}
                      className={`min-h-[52px] sm:min-h-[80px] p-1 sm:p-2 border-r border-gray-50 last:border-r-0 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-xs font-medium rounded-full mb-0.5 sm:mb-1 ${isToday ? 'bg-[#1a3a5c] text-white' : isSelected ? 'bg-blue-200 text-blue-900' : 'text-gray-700'}`}
                      >
                        {day.getUTCDate()}
                      </span>
                      {/* Event indicators: dots on mobile, labels on sm+ */}
                      {totalItems > 0 && (
                        <>
                          <div className="sm:hidden flex flex-wrap gap-0.5 mt-0.5">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <span key={ev.id} className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            ))}
                            {dayOccs.slice(0, Math.max(0, 3 - dayEvents.length)).map((occ) => (
                              <span key={`${occ.job.id}__${occ.dateKey}`} className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            ))}
                            {totalItems > 3 && <span className="text-[8px] text-gray-400">+{totalItems - 3}</span>}
                          </div>
                          <div className="hidden sm:block space-y-0.5">
                            {dayEvents.slice(0, 2).map((ev) => (
                              <div key={ev.id} className={`text-xs px-1 py-0.5 rounded truncate border ${EVENT_TYPE_BG[ev.eventType]}`}>
                                {ev.title}
                              </div>
                            ))}
                            {dayOccs.slice(0, Math.max(0, 2 - dayEvents.length)).map((occ) => (
                              <div
                                key={`${occ.job.id}__${occ.dateKey}`}
                                className="text-xs px-1 py-0.5 rounded truncate border border-dashed bg-gray-50 text-gray-600 border-gray-300"
                              >
                                🔁 {occ.job.title}
                              </div>
                            ))}
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

        {/* Day detail */}
        {selectedDate && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: events + recurring occurrences */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </h3>

              {selectedEvents.length === 0 && selectedOccurrences.length === 0 ? (
                <p className="text-gray-500 text-sm">No events on this day. Use the form to add one.</p>
              ) : (
                <div className="space-y-4">
                  {/* Explicit calendar events */}
                  {selectedEvents.map((ev) => (
                    <div key={ev.id} className="p-4 rounded-lg border border-gray-100">
                      <div className="flex items-start justify-between gap-3 mb-2">
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
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white" style={{ backgroundColor: ev.job.colour }}>
                                {ev.job.title}
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-gray-900 text-sm">{ev.title}</div>
                          {ev.description && <div className="text-xs text-gray-500 mt-0.5">{ev.description}</div>}
                          <div className="text-xs text-gray-400 mt-1">
                            {ev.startTime && `${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''} · `}
                            {ev.signups.length} signed up{ev.maxSignups ? ` / ${ev.maxSignups} max` : ''}
                          </div>
                        </div>
                        <form action={deleteCalendarEvent.bind(null, ev.id)}>
                          <button type="submit" className="text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap">Delete</button>
                        </form>
                      </div>
                      {ev.signups.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">Signed up ({ev.signups.length}):</p>
                          <div className="space-y-1">
                            {ev.signups.map((s) => (
                              <div key={s.id} className="flex items-center gap-2 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                                <span className="font-medium text-gray-700">{s.user.name ?? s.user.email}</span>
                                {s.user.name && <span className="text-gray-400">{s.user.email}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Recurring job occurrences (no CalendarEvent yet) */}
                  {selectedOccurrences.map((occ) => (
                    <div key={`${occ.job.id}__${occ.dateKey}`} className="p-4 rounded-lg border border-dashed border-gray-300 bg-gray-50">
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
                      </div>
                      <div className="font-medium text-gray-900 text-sm">{occ.job.title}</div>
                      {occ.job.description && <div className="text-xs text-gray-500 mt-0.5">{occ.job.description}</div>}
                      <div className="text-xs text-gray-400 mt-1">
                        {scheduleLabel(occ.job)}
                        {(occ.job.defaultStartTime || occ.job.defaultEndTime) && ` · ${occ.job.defaultStartTime ?? ''}${occ.job.defaultEndTime ? `–${occ.job.defaultEndTime}` : ''}`}
                        {occ.job.defaultMaxSignups && ` · Max ${occ.job.defaultMaxSignups}`}
                      </div>
                      <p className="text-xs text-gray-400 mt-2 italic">
                        No volunteers have signed up yet — a calendar entry will be created automatically when someone signs up.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: create event form */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Add Event on {selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
              </h3>
              <form
                action={async (formData: FormData) => {
                  'use server';
                  const title = formData.get('title') as string;
                  const description = formData.get('description') as string;
                  const eventType = formData.get('eventType') as CalendarEventType;
                  const dateStr = formData.get('date') as string;
                  const startTime = formData.get('startTime') as string;
                  const endTime = formData.get('endTime') as string;
                  const jobId = formData.get('jobId') as string;
                  const maxSignups = formData.get('maxSignups') as string;
                  const teamId = formData.get('teamId') as string;
                  await createCalendarEvent(title, description, eventType, dateStr, startTime, endTime, jobId, maxSignups, teamId);
                }}
                className="space-y-4"
              >
                <input type="hidden" name="date" value={dateToParam(selectedDate)} />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                  <input name="title" type="text" required placeholder="Event title" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea name="description" rows={2} placeholder="Optional description" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    <select name="eventType" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="EVENT">Event</option>
                      <option value="ROSTER">Roster slot</option>
                      <option value="HELP_NEEDED">Help needed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Team (optional)</label>
                    <select name="teamId" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— All teams —</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Job (optional)</label>
                  <select name="jobId" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— None —</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} {j.scheduleType !== 'ONE_OFF' ? `(${j.scheduleType === 'WEEKLY' ? 'weekly' : 'monthly'})` : '(rostered)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Start time</label>
                    <input name="startTime" type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">End time</label>
                    <input name="endTime" type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Max sign-ups</label>
                    <input name="maxSignups" type="number" min="1" placeholder="∞" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                  Create Event
                </button>
              </form>
            </div>
          </div>
        )}

        {!selectedDate && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-sm text-blue-700">
            👆 Click on a day in the calendar above to view events, see who has signed up, and add new ones.
            <br />
            <span className="text-xs text-blue-500 mt-1 block">
              🔁 Dashed entries are recurring jobs — they appear automatically each week/month. Volunteers can sign up directly.
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
