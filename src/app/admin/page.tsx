import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackTs } from '@/lib/db';
import Link from 'next/link';

export default async function AdminPage() {
  const user = await requireCapability('admin:users.read');

  const db = getDb();

  const { n: userCount } = db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number };
  const { n: roleCount } = db.prepare('SELECT COUNT(*) as n FROM roles').get() as { n: number };
  const { n: teamCount } = db.prepare('SELECT COUNT(*) as n FROM teams').get() as { n: number };
  const { n: auditCount } = db.prepare('SELECT COUNT(*) as n FROM audit_logs').get() as { n: number };
  const { n: fileCount } = db.prepare('SELECT COUNT(*) as n FROM file_assets').get() as { n: number };
  const { n: announcementCount } = db.prepare('SELECT COUNT(*) as n FROM announcements').get() as { n: number };
  const { n: eventCount } = db.prepare('SELECT COUNT(*) as n FROM calendar_events').get() as { n: number };

  const rawRecentLogs = db.prepare(`
    SELECT al.id, al.action, al.resource, al.resourceId, al.createdAt,
           u.email as user_email
    FROM audit_logs al
    LEFT JOIN users u ON al.userId = u.id
    ORDER BY al.createdAt DESC
    LIMIT 10
  `).all() as {
    id: string; action: string; resource: string | null; resourceId: string | null;
    createdAt: string; user_email: string | null;
  }[];

  const recentAuditLogs = rawRecentLogs.map((l) => ({
    ...l,
    createdAt: unpackTs(l.createdAt),
    user: l.user_email ? { email: l.user_email } : null,
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Panel</h1>
          <p className="text-gray-500">System overview and management.</p>
        </div>

        {/* Quick-access admin sections */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <AdminCard
            href="/admin/users"
            icon="👥"
            title="User Management"
            description="Add, remove and manage volunteer accounts. Assign roles, teams and administration rights."
            badge={`${userCount} users`}
          />
          <AdminCard
            href="/admin/roles"
            icon="🎭"
            title="Roles & Permissions"
            description="Define roles and assign capabilities to control what each role can access."
            badge={`${roleCount} roles`}
          />
          <AdminCard
            href="/admin/teams"
            icon="🏷️"
            title="Teams"
            description="Manage volunteer teams, assign team leaders and group assignments."
            badge={`${teamCount} teams`}
          />
          <AdminCard
            href="/admin/teams/tasks"
            icon="📋"
            title="Task Forms"
            description="Create and manage structured task forms for teams, including equipment, consumables and safety information."
          />
          <AdminCard
            href="/admin/audit"
            icon="📊"
            title="Audit Logs"
            description="View a full audit trail of all actions taken in the system."
            badge={`${auditCount} events`}
          />
          <AdminCard
            href="/admin/files"
            icon="📁"
            title="File Assets"
            description="View and manage uploaded files and documents."
            badge={`${fileCount} file${fileCount !== 1 ? 's' : ''}`}
          />
          <AdminCard
            href="/admin/announcements"
            icon="📣"
            title="Announcements"
            description="Create and manage announcements for volunteers."
            badge={`${announcementCount} announcement${announcementCount !== 1 ? 's' : ''}`}
          />
          <AdminCard
            href="/admin/schedule"
            icon="📅"
            title="Schedule"
            description="Create events, roster slots and help requests on the volunteer calendar."
            badge={`${eventCount} event${eventCount !== 1 ? 's' : ''}`}
          />
          <AdminCard
            href="/admin/settings"
            icon="⚙️"
            title="System Settings"
            description="Configure site-wide settings including SMTP email delivery."
          />
          <AdminCard
            href="/admin/museum"
            icon="🏛️"
            title="Museum Status &amp; Hours"
            description="Manage museum announcements, opening hours, special closures, and bank holidays."
          />
        </div>

        {/* Current user info */}
        <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Current User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Email:</span>{' '}
              <span className="font-medium">{user.email}</span>
            </div>
            <div>
              <span className="text-gray-500">Name:</span>{' '}
              <span className="font-medium">{user.name ?? '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>{' '}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  user.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-800'
                    : user.status === 'SUSPENDED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {user.status}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-gray-500 text-sm">Capabilities:</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-mono"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
          <StatCard label="Users" value={userCount} icon="👥" />
          <StatCard label="Roles" value={roleCount} icon="🎭" />
          <StatCard label="Teams" value={teamCount} icon="🏷️" />
          <StatCard label="Audit Events" value={auditCount} icon="📊" />
          <StatCard label="Files" value={fileCount} icon="📁" />
          <StatCard label="Announcements" value={announcementCount} icon="📣" />
          <StatCard label="Events" value={eventCount} icon="📅" />
        </div>

        {/* Recent audit logs */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Audit Log</h2>
          {recentAuditLogs.length === 0 ? (
            <p className="text-gray-500 text-sm">No audit events yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">When</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">User</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Action</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Resource</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAuditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                        {log.createdAt.toLocaleString('en-GB')}
                      </td>
                      <td className="py-2 px-3">
                        {log.user?.email ?? <span className="text-gray-400">system</span>}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-gray-700">{log.action}</td>
                      <td className="py-2 px-3 text-gray-500">{log.resource ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function AdminCard({
  href,
  icon,
  title,
  description,
  badge,
  comingSoon,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
  comingSoon?: boolean;
}) {
  const inner = (
    <div className={`bg-white rounded-xl border p-6 h-full transition-shadow ${comingSoon ? 'border-gray-100 opacity-60' : 'border-gray-200 hover:shadow-md'}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex items-center gap-2">
          {badge && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{badge}</span>}
          {comingSoon && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Coming soon</span>}
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 text-sm">{description}</p>
    </div>
  );

  if (comingSoon) return <div>{inner}</div>;
  return <Link href={href}>{inner}</Link>;
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-gray-500 text-sm">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</div>
    </div>
  );
}
