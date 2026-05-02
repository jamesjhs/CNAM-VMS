import { requireAuth, hasAnyCapability } from '@/lib/auth-helpers';
import { getDb, unpackDate, unpackBool } from '@/lib/db';
import Link from 'next/link';

export default async function CoordinationPage() {
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

  const coordinationLinks = [
    { href: '/coordination/volunteers', label: 'Volunteers', icon: '👥', description: 'Browse, filter, and manage volunteer information' },
    { href: '/coordination/availability', label: 'Availability', icon: '📅', description: 'See which volunteers are available on specific dates' },
    { href: '/coordination/projects', label: 'Projects', icon: '📋', description: 'Track projects, teams, and task assignments' },
    { href: '/coordination/messages', label: 'Messages', icon: '💬', description: 'Communicate with individuals or groups of volunteers' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Coordination Dashboard</h1>
        <p className="text-gray-600">Complete view of the CNAM timetabling system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Volunteers" value={volunteersCount.count} icon="👥" />
        <StatCard label="Staff" value={staffCount.count} icon="👨‍💼" />
        <StatCard label="Projects" value={activeTeams.count} icon="📋" />
        <StatCard label="Upcoming Events" value={upcomingEvents.count} icon="📅" />
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {coordinationLinks.map((link) => (
          <CoordinationCard
            key={link.href}
            href={link.href}
            icon={link.icon}
            title={link.label}
            description={link.description}
          />
        ))}
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

function CoordinationCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-gray-200 p-6 h-full hover:shadow-md transition-shadow">
        <div className="mb-3">
          <span className="text-3xl">{icon}</span>
        </div>
        <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>
    </Link>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-gray-500 text-xs sm:text-sm">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-gray-900">{value.toLocaleString()}</div>
    </div>
  );
}
