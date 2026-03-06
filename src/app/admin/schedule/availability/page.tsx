import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  parseMonthParam,
  fmtMonth,
  prevMonth,
  nextMonth,
  getCalendarWeeks,
  dateToParam,
  isSameDate,
  parseDate,
  MONTH_NAMES,
  DAY_NAMES_SHORT,
  monthDateRange,
} from '@/lib/calendar';

export default async function AdminAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  await requireCapability('admin:calendar.write');

  const { month: monthParam, day: dayParam } = await searchParams;
  const { year, month } = parseMonthParam(monthParam);
  const currentMonthStr = fmtMonth(year, month);
  const selectedDate = dayParam ? parseDate(dayParam) : null;

  // Fetch all volunteer date slots for this month
  const slots = await prisma.volunteerDateSlot.findMany({
    where: { date: monthDateRange(year, month) },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: {
      user: { select: { id: true, name: true, email: true, accountType: true } },
    },
  });

  // Fetch all jobs for label lookup
  const allJobs = await prisma.job.findMany({ orderBy: [{ isRolling: 'desc' }, { title: 'asc' }] });
  const jobMap = new Map(allJobs.map((j) => [j.id, j]));

  // Group slots by date
  const slotsByDate = new Map<string, typeof slots>();
  for (const slot of slots) {
    const key = dateToParam(slot.date);
    if (!slotsByDate.has(key)) slotsByDate.set(key, []);
    slotsByDate.get(key)!.push(slot);
  }

  const selectedDateKey = selectedDate ? dateToParam(selectedDate) : null;
  const selectedSlots = selectedDate ? (slotsByDate.get(selectedDateKey!) ?? []) : [];

  // Summary counts for the month
  const uniqueVolunteers = new Set(slots.map((s) => s.userId));
  const weeks = getCalendarWeeks(year, month);
  const today = new Date();

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <Link href="/admin/schedule" className="hover:text-gray-700">Schedule</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Volunteer Availability</span>
        </nav>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Volunteer Availability</h1>
            <p className="text-gray-500">
              See which volunteers have indicated they are available on specific dates.
              Click a day to see who&apos;s available and what they can help with.
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div className="font-semibold text-gray-900">{slots.length}</div>
            <div>availability entries</div>
            <div className="mt-0.5 font-semibold text-gray-900">{uniqueVolunteers.size}</div>
            <div>volunteers this month</div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <Link
              href={`/admin/schedule/availability?month=${prevMonth(year, month)}`}
              className="text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              ← Previous
            </Link>
            <h2 className="font-semibold text-gray-900">{MONTH_NAMES[month]} {year}</h2>
            <Link
              href={`/admin/schedule/availability?month=${nextMonth(year, month)}`}
              className="text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Next →
            </Link>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAY_NAMES_SHORT.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
            ))}
          </div>

          <div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={di} className="min-h-[70px] bg-gray-50/50 border-r border-gray-50 last:border-r-0" />;
                  }
                  const dayKey = dateToParam(day);
                  const daySlots = slotsByDate.get(dayKey) ?? [];
                  const isToday = isSameDate(day, today);
                  const isSelected = selectedDate ? isSameDate(day, selectedDate) : false;

                  return (
                    <Link
                      key={di}
                      href={`/admin/schedule/availability?month=${currentMonthStr}&day=${dayKey}`}
                      className={`min-h-[70px] p-2 border-r border-gray-50 last:border-r-0 hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-green-50 ring-1 ring-inset ring-green-300' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                            isToday ? 'bg-[#1a3a5c] text-white' : isSelected ? 'bg-green-200 text-green-900' : 'text-gray-700'
                          }`}
                        >
                          {day.getUTCDate()}
                        </span>
                        {daySlots.length > 0 && (
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-1 py-0.5 rounded-full">
                            {daySlots.length}
                          </span>
                        )}
                      </div>
                      {daySlots.length > 0 && (
                        <div className="space-y-0.5">
                          {daySlots.slice(0, 2).map((s) => (
                            <div key={s.id} className="text-xs text-gray-600 truncate">
                              {s.user.name ?? s.user.email}
                            </div>
                          ))}
                          {daySlots.length > 2 && (
                            <div className="text-xs text-gray-400">+{daySlots.length - 2} more</div>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail panel */}
        {selectedDate && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-1">
              {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {selectedSlots.length === 0
                ? 'No volunteers have indicated availability on this day.'
                : `${selectedSlots.length} volunteer${selectedSlots.length !== 1 ? 's' : ''} available`}
            </p>

            {selectedSlots.length > 0 && (
              <div className="space-y-4">
                {selectedSlots.map((slot) => {
                  const slotJobs = slot.jobIds
                    .map((id) => jobMap.get(id))
                    .filter(Boolean) as typeof allJobs;
                  const rollingSlotJobs = slotJobs.filter((j) => j.isRolling);
                  const rosteredSlotJobs = slotJobs.filter((j) => !j.isRolling);

                  return (
                    <div key={slot.id} className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-medium text-sm text-gray-900">
                              {slot.user.name ?? slot.user.email}
                            </div>
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {slot.user.accountType.toLowerCase()}
                            </span>
                          </div>
                          {slot.user.name && (
                            <div className="text-xs text-gray-400 mb-2">{slot.user.email}</div>
                          )}

                          {/* Time */}
                          <div className="text-xs text-gray-600 mb-2">
                            🕐{' '}
                            {slot.startTime || slot.endTime
                              ? `${slot.startTime ?? ''}${slot.endTime ? `–${slot.endTime}` : ''}`
                              : 'All day'}
                          </div>

                          {/* Jobs they can help with */}
                          {slotJobs.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {rollingSlotJobs.map((j) => (
                                <span
                                  key={j.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white"
                                  style={{ backgroundColor: j.colour }}
                                >
                                  {j.title}
                                </span>
                              ))}
                              {rosteredSlotJobs.map((j) => (
                                <span
                                  key={j.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white opacity-80"
                                  style={{ backgroundColor: j.colour }}
                                >
                                  {j.title}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Notes */}
                          {slot.notes && (
                            <div className="text-xs text-gray-500 italic">&ldquo;{slot.notes}&rdquo;</div>
                          )}
                        </div>

                        <Link
                          href={`/admin/users/${slot.user.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap shrink-0"
                        >
                          View profile →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!selectedDate && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-sm text-green-700">
            👆 Click on a day in the calendar above to see which volunteers are available and what they can help with.
          </div>
        )}

        {/* Full month list for days with availability */}
        {slots.length > 0 && !selectedDate && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">All Availability in {MONTH_NAMES[month]}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Volunteer</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Hours</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Can help with</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => {
                    const slotJobs = slot.jobIds
                      .map((id) => jobMap.get(id))
                      .filter(Boolean) as typeof allJobs;
                    return (
                      <tr key={slot.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                          <Link
                            href={`/admin/schedule/availability?month=${currentMonthStr}&day=${dateToParam(slot.date)}`}
                            className="hover:text-blue-600"
                          >
                            {slot.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                          </Link>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900">{slot.user.name ?? slot.user.email}</div>
                          {slot.user.name && <div className="text-xs text-gray-400">{slot.user.email}</div>}
                        </td>
                        <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                          {slot.startTime || slot.endTime
                            ? `${slot.startTime ?? ''}${slot.endTime ? `–${slot.endTime}` : ''}`
                            : 'All day'}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {slotJobs.length === 0 ? (
                              <span className="text-gray-400">—</span>
                            ) : (
                              slotJobs.map((j) => (
                                <span
                                  key={j.id}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs text-white"
                                  style={{ backgroundColor: j.colour }}
                                >
                                  {j.title}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-gray-500 text-xs">{slot.notes ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
