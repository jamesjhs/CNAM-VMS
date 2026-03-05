import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import type { UserStatus } from '@prisma/client';

const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
};

export default async function UsersAdminPage() {
  await requireCapability('admin:users.read');

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      userRoles: { include: { role: { select: { name: true } } } },
      userTeams: { include: { team: { select: { name: true } } } },
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Users</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">User Management</h1>
            <p className="text-gray-500">Add, remove and manage volunteer accounts.</p>
          </div>
          <span className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''}</span>
        </div>

        {users.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No users found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Name / Email</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Roles</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Teams</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Joined</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{user.name ?? <span className="text-gray-400 italic">No name</span>}</div>
                        <div className="text-gray-500">{user.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[user.status]}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.userRoles.length === 0 ? (
                            <span className="text-gray-400 text-xs italic">None</span>
                          ) : (
                            user.userRoles.map((ur) => (
                              <span key={ur.roleId} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                                {ur.role.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.userTeams.length === 0 ? (
                            <span className="text-gray-400 text-xs italic">None</span>
                          ) : (
                            user.userTeams.map((ut) => (
                              <span key={ut.teamId} className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-xs font-medium">
                                {ut.team.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        {user.createdAt.toLocaleDateString('en-GB')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
