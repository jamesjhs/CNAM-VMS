import { requireAuth, hasAnyCapability } from '@/lib/auth-helpers';
import { getDb, unpackDate, unpackBool } from '@/lib/db';
import Link from 'next/link';

export default async function StaffPage() {
  const user = await requireAuth();
  const db = getDb();

  // Get stats
  const volunteersCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE accountType = ?').get('VOLUNTEER') as { count: number };
  const staffCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE accountType = ?').get('STAFF') as { count: number };
  const activeTeams = db.prepare('SELECT COUNT(*) as count FROM teams').get() as { count: number };
  
  const now = new Date();
  const todayStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  const in30dStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30))
    .toISOString()
    .slice(0, 10);
    
  const upcomingEvents = db.prepare(`
    SELECT COUNT(*) as count 
    FROM calendar_events 
    WHERE date >= ? AND date < ?
  `).get(todayStr, in30dStr) as { count: number };

  const rawAvailability = db.prepare(`
    SELECT COUNT(DISTINCT userId) as count
    FROM volunteer_date_slots
    WHERE date >= ?
  `).get(todayStr) as { count: number };

  const staffCapabilities = [
    'staff:volunteer.read',
    'staff:projects.read',
    'staff:messaging.write',
    'staff:schedule.read',
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff Dashboard</h1>
        <p className="text-gray-600">Complete view of the CNAM timetabling system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link href="/staff/volunteers" className="block">
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="text-sm text-gray-500 font-medium mb-1">Total Volunteers</div>
            <div className="text-3xl font-bold text-gray-900">{volunteersCount.count}</div>
            <div className="text-xs text-gray-400 mt-2">Click to manage</div>
          </div>
        </Link>

        <Link href="/staff/availability" className="block">
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="text-sm text-gray-500 font-medium mb-1">Available Today</div>
            <div className="text-3xl font-bold text-gray-900">{rawAvailability.count}</div>
            <div className="text-xs text-gray-400 mt-2">Volunteers with availability set</div>
          </div>
        </Link>

        <Link href="/staff/projects" className="block">
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="text-sm text-gray-500 font-medium mb-1">Active Projects</div>
            <div className="text-3xl font-bold text-gray-900">{activeTeams.count}</div>
            <div className="text-xs text-gray-400 mt-2">Teams and projects</div>
          </div>
        </Link>

        <Link href="/staff/availability" className="block">
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="text-sm text-gray-500 font-medium mb-1">Upcoming Events</div>
            <div className="text-3xl font-bold text-gray-900">{upcomingEvents.count}</div>
            <div className="text-xs text-gray-400 mt-2">Next 30 days</div>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {hasAnyCapability(user, ['staff:volunteer.read']) && (
          <Link href="/staff/volunteers" className="block">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-6 hover:shadow-lg transition-shadow">
              <div className="text-2xl mb-2">👥</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">View All Volunteers</h3>
              <p className="text-sm text-gray-600">Browse, filter, and manage volunteer information and assignments</p>
            </div>
          </Link>
        )}

        {hasAnyCapability(user, ['staff:schedule.read']) && (
          <Link href="/staff/availability" className="block">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-6 hover:shadow-lg transition-shadow">
              <div className="text-2xl mb-2">📅</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Availability Calendar</h3>
              <p className="text-sm text-gray-600">See which volunteers are available on specific dates</p>
            </div>
          </Link>
        )}

        {hasAnyCapability(user, ['staff:projects.read']) && (
          <Link href="/staff/projects" className="block">
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200 p-6 hover:shadow-lg transition-shadow">
              <div className="text-2xl mb-2">📋</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Upcoming Projects</h3>
              <p className="text-sm text-gray-600">Track projects, teams, and task assignments</p>
            </div>
          </Link>
        )}

        {hasAnyCapability(user, ['staff:messaging.write']) && (
          <Link href="/staff/messages" className="block">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-6 hover:shadow-lg transition-shadow">
              <div className="text-2xl mb-2">💬</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Send Messages</h3>
              <p className="text-sm text-gray-600">Communicate with individuals or groups of volunteers</p>
            </div>
          </Link>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">📊 Staff Access Permissions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          {hasAnyCapability(user, ['staff:volunteer.read']) && <li>✓ View all volunteers and their information</li>}
          {hasAnyCapability(user, ['staff:schedule.read']) && <li>✓ View volunteer availability calendar</li>}
          {hasAnyCapability(user, ['staff:projects.read']) && <li>✓ View teams and upcoming projects</li>}
          {hasAnyCapability(user, ['staff:messaging.write']) && <li>✓ Send messages to volunteers</li>}
        </ul>
      </div>
    </div>
  );
}
