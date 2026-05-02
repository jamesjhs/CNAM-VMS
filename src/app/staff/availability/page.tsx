import { requireCapability } from '@/lib/auth-helpers';
import { getDb, unpackDate } from '@/lib/db';
import Link from 'next/link';

export default async function StaffAvailabilityPage() {
  await requireCapability('staff:schedule.read');

  const db = getDb();

  // Get upcoming dates with availability
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30));

  const rawAvailability = db.prepare(`
    SELECT va.date, u.id, u.name, u.email
    FROM volunteer_availability va
    JOIN users u ON va.userId = u.id
    WHERE va.date >= ? AND va.date < ?
    ORDER BY va.date ASC, u.name ASC
  `).all(startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)) as {
    date: string;
    id: string;
    name: string | null;
    email: string;
  }[];

  // Group by date
  const availabilityByDate: { [date: string]: { id: string; name: string | null; email: string }[] } = {};
  rawAvailability.forEach((a) => {
    if (!availabilityByDate[a.date]) {
      availabilityByDate[a.date] = [];
    }
    availabilityByDate[a.date].push({ id: a.id, name: a.name, email: a.email });
  });

  const sortedDates = Object.keys(availabilityByDate).sort();

  // Get upcoming events for context
  const rawEvents = db.prepare(`
    SELECT ce.date, COUNT(*) as eventCount
    FROM calendar_events ce
    WHERE ce.date >= ? AND ce.date < ?
    GROUP BY ce.date
  `).all(startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)) as {
    date: string;
    eventCount: number;
  }[];

  const eventsByDate: { [date: string]: number } = {};
  rawEvents.forEach((e) => {
    eventsByDate[e.date] = e.eventCount;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Volunteer Availability</h1>
        <p className="text-gray-600">Calendar view of which volunteers are available on each date</p>
      </div>

      {sortedDates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No availability data for the next 30 days</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((date) => {
            const volunteers = availabilityByDate[date];
            const eventCount = eventsByDate[date] || 0;
            const dateObj = new Date(date + 'T00:00:00Z');
            const dayName = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

            return (
              <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{dayName}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{volunteers.length} volunteers available</p>
                  </div>
                  {eventCount > 0 && (
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {eventCount} event{eventCount !== 1 ? 's' : ''} scheduled
                    </div>
                  )}
                </div>
                <div className="divide-y divide-gray-100">
                  {volunteers.map((vol) => (
                    <div key={vol.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{vol.name || 'Unnamed Volunteer'}</p>
                        <p className="text-xs text-gray-500">{vol.email}</p>
                      </div>
                      <span className="text-xs font-semibold text-green-600">✓ Available</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">📅 How This Works</h3>
        <p className="text-sm text-blue-800 mb-3">
          This page shows volunteers&apos; availability for the next 30 days based on their personal availability settings. Each date shows:
        </p>
        <ul className="text-sm text-blue-800 space-y-1 ml-4">
          <li>• The number of volunteers available on that date</li>
          <li>• How many events are scheduled for that date</li>
          <li>• The names and contact information of available volunteers</li>
        </ul>
      </div>
    </div>
  );
}
