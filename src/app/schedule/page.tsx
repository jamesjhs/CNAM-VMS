import { requireAuth } from '@/lib/auth-helpers';
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
} from '@/lib/calendar';
import {
  signupForEvent,
  withdrawFromEvent,
  saveVolunteerDateSlot,
  deleteVolunteerDateSlot,
} from './actions';

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const user = await requireAuth();

  const { month: monthParam, day: dayParam } = await searchParams;
  const { year, month } = parseMonthParam(monthParam);
  const currentMonthStr = fmtMonth(year, month);
  const selectedDate = dayParam ? parseDate(dayParam) : null;

  // Fetch events, user signups, user date slots for this month
  const [events, mySignups, mySlots, allJobs] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { date: monthDateRange(year, month) },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: {
        job: { select: { id: true, title: true, colour: true } },
        _count: { select: { signups: true } },
      },
    }),
    prisma.eventSignup.findMany({
      where: {
        userId: user.id,
        event: { date: monthDateRange(year, month) },
      },
      select: { eventId: true },
    }),
    prisma.volunteerDateSlot.findMany({
      where: {
        userId: user.id,
        date: monthDateRange(year, month),
      },
    }),
    prisma.job.findMany({ orderBy: [{ isRolling: 'desc' }, { title: 'asc' }] }),
  ]);

  const mySignupIds = new Set(mySignups.map((s) => s.eventId));
  const mySlotsByDate = new Map<string, typeof mySlots[0]>();
  for (const slot of mySlots) {
    mySlotsByDate.set(dateToParam(slot.date), slot);
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
  const mySlotForDay = selectedDateKey ? mySlotsByDate.get(selectedDateKey) : null;

  const today = new Date();
  const weeks = getCalendarWeeks(year, month);

  const rollingJobs = allJobs.filter((j) => j.isRolling);
  const rosteredJobs = allJobs.filter((j) => !j.isRolling);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Schedule &amp; Availability</h1>
          <p className="text-gray-500">Browse events, sign up for shifts, and record your availability.</p>
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
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 text-green-800">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>My availability
          </span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <Link
              href={`/schedule?month=${prevMonth(year, month)}`}
              className="text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              ← Previous
            </Link>
            <h2 className="font-semibold text-gray-900">
              {MONTH_NAMES[month]} {year}
            </h2>
            <Link
              href={`/schedule?month=${nextMonth(year, month)}`}
              className="text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Next →
            </Link>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAY_NAMES_SHORT.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar weeks */}
          <div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={di} className="min-h-[80px] bg-gray-50/50 border-r border-gray-50 last:border-r-0" />;
                  }
                  const dayKey = dateToParam(day);
                  const dayEvents = eventsByDate.get(dayKey) ?? [];
                  const hasMySlot = mySlotsByDate.has(dayKey);
                  const isToday = isSameDate(day, today);
                  const isSelected = selectedDate ? isSameDate(day, selectedDate) : false;

                  return (
                    <Link
                      key={di}
                      href={`/schedule?month=${currentMonthStr}&day=${dayKey}`}
                      className={`min-h-[80px] p-2 border-r border-gray-50 last:border-r-0 hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
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
                          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" title="My availability" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className={`text-xs px-1 py-0.5 rounded truncate border ${EVENT_TYPE_BG[ev.eventType]}`}
                          >
                            {mySignupIds.has(ev.id) && <span className="mr-0.5">✓</span>}
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-400">+{dayEvents.length - 2} more</div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail panel */}
        {selectedDate && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Events for the selected day */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                {selectedDate.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </h3>

              {selectedEvents.length === 0 ? (
                <p className="text-gray-500 text-sm">No events on this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((ev) => {
                    const isSignedUp = mySignupIds.has(ev.id);
                    const isFull =
                      ev.maxSignups !== null && ev._count.signups >= ev.maxSignups && !isSignedUp;

                    return (
                      <div key={ev.id} className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${EVENT_TYPE_BG[ev.eventType]}`}>
                                {EVENT_TYPE_LABELS[ev.eventType]}
                              </span>
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
                            {ev.description && <div className="text-xs text-gray-500 mt-0.5">{ev.description}</div>}
                            <div className="text-xs text-gray-400 mt-1">
                              {ev.startTime && `${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''} · `}
                              {ev._count.signups} signed up
                              {ev.maxSignups ? ` of ${ev.maxSignups}` : ''}
                              {isFull && <span className="text-red-500 ml-1">· Full</span>}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isSignedUp ? (
                              <form action={withdrawFromEvent.bind(null, ev.id)}>
                                <button
                                  type="submit"
                                  className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors whitespace-nowrap"
                                >
                                  Withdraw
                                </button>
                              </form>
                            ) : (
                              <form action={signupForEvent.bind(null, ev.id)}>
                                <button
                                  type="submit"
                                  disabled={isFull}
                                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
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
                </div>
              )}
            </div>

            {/* My availability for this day */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                My Availability on{' '}
                {selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
              </h3>

              {mySlotForDay ? (
                <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-green-800">
                        {mySlotForDay.startTime || mySlotForDay.endTime
                          ? `${mySlotForDay.startTime ?? ''}${mySlotForDay.endTime ? `–${mySlotForDay.endTime}` : ''}`
                          : 'All day'}
                      </div>
                      {mySlotForDay.jobIds.length > 0 && (
                        <div className="text-xs text-green-700 mt-1">
                          Jobs: {mySlotForDay.jobIds
                            .map((id) => allJobs.find((j) => j.id === id)?.title ?? id)
                            .join(', ')}
                        </div>
                      )}
                      {mySlotForDay.notes && (
                        <div className="text-xs text-green-600 mt-1">{mySlotForDay.notes}</div>
                      )}
                    </div>
                    <form action={deleteVolunteerDateSlot.bind(null, selectedDateKey!)}>
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              ) : null}

              {/* Add / update availability form */}
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
                  await saveVolunteerDateSlot(dateStr, startTime, endTime, jobIds, notes);
                }}
                className="space-y-4"
              >
                <input type="hidden" name="date" value={selectedDateKey!} />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                    <input
                      name="startTime"
                      type="time"
                      defaultValue={mySlotForDay?.startTime ?? ''}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Until</label>
                    <input
                      name="endTime"
                      type="time"
                      defaultValue={mySlotForDay?.endTime ?? ''}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Rolling jobs */}
                {rollingJobs.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Rolling duties I can help with:</p>
                    <div className="space-y-1.5">
                      {rollingJobs.map((job) => (
                        <label key={job.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name={`job_${job.id}`}
                            defaultChecked={mySlotForDay?.jobIds.includes(job.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: job.colour }} />
                          <span className="text-sm text-gray-700">{job.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rostered jobs */}
                {rosteredJobs.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Rostered roles I&apos;m willing to do:</p>
                    <div className="space-y-1.5">
                      {rosteredJobs.map((job) => (
                        <label key={job.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name={`job_${job.id}`}
                            defaultChecked={mySlotForDay?.jobIds.includes(job.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: job.colour }} />
                          <span className="text-sm text-gray-700">{job.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                  <input
                    name="notes"
                    type="text"
                    defaultValue={mySlotForDay?.notes ?? ''}
                    placeholder="Any additional notes (optional)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {mySlotForDay ? 'Update My Availability' : 'Save My Availability'}
                </button>
              </form>
            </div>
          </div>
        )}

        {!selectedDate && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-sm text-blue-700">
            👆 Click on a day to see events, sign up for shifts, or record your availability.
          </div>
        )}

        {/* Rolling jobs info panel */}
        {rollingJobs.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Rolling Duties</h3>
            <p className="text-sm text-gray-500 mb-4">
              These duties happen regularly and always need volunteers. Click on any day to indicate you can help with them.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rollingJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50"
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: job.colour }} />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{job.title}</div>
                    {job.description && <div className="text-xs text-gray-500 mt-0.5">{job.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
