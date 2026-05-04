import { requireCapability } from '@/lib/auth-helpers';
import { getDb, unpackDate, unpackBool } from '@/lib/db';
import Link from 'next/link';

export default async function CoordinationVolunteersPage() {
  await requireCapability('staff:volunteer.read');

  const db = getDb();

  // Get all users with the Volunteer role
  const rawVolunteers = db.prepare(`
    SELECT u.id, u.name, u.email, u.status, u.createdAt,
           (SELECT number FROM user_phones WHERE userId = u.id AND isPrimary = 1 LIMIT 1) as phone,
           COUNT(DISTINCT ut.teamId) as teamCount,
           COUNT(DISTINCT es.eventId) as eventSignups
    FROM users u
    JOIN user_roles ur ON u.id = ur.userId
    JOIN roles r ON ur.roleId = r.id AND r.name = 'Volunteer'
    LEFT JOIN user_teams ut ON u.id = ut.userId
    LEFT JOIN event_signups es ON u.id = es.userId
    GROUP BY u.id
    ORDER BY u.name ASC
  `).all() as {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    status: string;
    createdAt: string;
    teamCount: number;
    eventSignups: number;
  }[];

  const volunteers = rawVolunteers.map((v) => ({
    ...v,
    createdAt: unpackDate(v.createdAt),
  }));

  // Get availability count for today
  const now = new Date();
  const todayStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  const availabilityMap = new Map<string, boolean>();
  const rawAvailability = db.prepare(`
    SELECT DISTINCT userId FROM volunteer_date_slots WHERE date >= ?
  `).all(todayStr) as { userId: string }[];

  rawAvailability.forEach((a) => availabilityMap.set(a.userId, true));

  const statusBadges = {
    ACTIVE: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
    INACTIVE: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactive' },
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending' },
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Volunteers</h1>
        <p className="text-gray-600">{volunteers.length} volunteers in the system</p>
      </div>

      {volunteers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No volunteers found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Teams</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Events</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {volunteers.map((vol) => {
                const statusInfo = statusBadges[vol.status as keyof typeof statusBadges] || statusBadges.INACTIVE;
                const isAvailable = availabilityMap.has(vol.id);
                return (
                  <tr key={vol.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{vol.name || 'Unnamed'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{vol.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{vol.phone || '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{vol.teamCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{vol.eventSignups}</td>
                    <td className="px-6 py-4 text-sm">
                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium">✓ Yes</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 About This View</h3>
        <p className="text-sm text-blue-800">
          This page shows all volunteers in the system. You can see their contact information, team memberships, event signups, and current availability status.
        </p>
      </div>
    </div>
  );
}
