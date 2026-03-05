import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  updateUserStatus,
  deleteUser,
  assignRole,
  removeRole,
  assignTeam,
  removeTeam,
} from '../actions';
import type { UserStatus } from '@prisma/client';

const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability('admin:users.read');

  const { id } = await params;

  const [user, allRoles, allTeams] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        userTeams: { include: { team: true } },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    }),
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
    prisma.team.findMany({ orderBy: { name: 'asc' } }),
  ]);

  if (!user) notFound();

  const assignedRoleIds = new Set(user.userRoles.map((ur) => ur.roleId));
  const assignedTeamIds = new Set(user.userTeams.map((ut) => ut.teamId));

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <Link href="/admin/users" className="hover:text-gray-700">Users</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{user.name ?? user.email}</span>
        </nav>

        {/* User header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{user.name ?? <span className="text-gray-400 italic">No name set</span>}</h1>
              <p className="text-gray-500 mt-0.5">{user.email}</p>
              <p className="text-gray-400 text-xs mt-1">Member since {user.createdAt.toLocaleDateString('en-GB')}</p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${STATUS_STYLES[user.status]}`}>
              {user.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Status management */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Account Status</h2>
            <div className="flex flex-col gap-2">
              {(['ACTIVE', 'PENDING', 'SUSPENDED'] as UserStatus[]).map((status) => (
                <form key={status} action={updateUserStatus.bind(null, user.id, status)}>
                  <button
                    type="submit"
                    disabled={user.status === status}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      user.status === status
                        ? 'border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed'
                        : status === 'ACTIVE'
                        ? 'border-green-200 hover:bg-green-50 text-green-700'
                        : status === 'SUSPENDED'
                        ? 'border-red-200 hover:bg-red-50 text-red-700'
                        : 'border-yellow-200 hover:bg-yellow-50 text-yellow-700'
                    }`}
                  >
                    {user.status === status ? `✓ ${status}` : `Set to ${status}`}
                  </button>
                </form>
              ))}
            </div>
          </div>

          {/* Delete user */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Danger Zone</h2>
            <p className="text-gray-500 text-sm mb-4">
              Permanently delete this user account and all associated data. This cannot be undone.
            </p>
            <form action={deleteUser.bind(null, user.id)}>
              <button
                type="submit"
                className="w-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                onClick={(e) => {
                  if (!confirm(`Delete user ${user.email}? This cannot be undone.`)) {
                    e.preventDefault();
                  }
                }}
              >
                Delete User Account
              </button>
            </form>
          </div>
        </div>

        {/* Roles */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Roles</h2>
          {allRoles.length === 0 ? (
            <p className="text-gray-400 text-sm">No roles defined yet. <Link href="/admin/roles" className="text-blue-600 hover:underline">Create roles →</Link></p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allRoles.map((role) => {
                const hasRole = assignedRoleIds.has(role.id);
                return (
                  <div key={role.id} className={`flex items-center justify-between p-3 rounded-lg border ${hasRole ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{role.name}</div>
                      {role.description && <div className="text-xs text-gray-500 mt-0.5">{role.description}</div>}
                    </div>
                    {hasRole ? (
                      <form action={removeRole.bind(null, user.id, role.id)}>
                        <button type="submit" className="text-xs text-red-600 hover:text-red-800 font-medium ml-3 whitespace-nowrap">
                          Remove
                        </button>
                      </form>
                    ) : (
                      <form action={assignRole.bind(null, user.id, role.id)}>
                        <button type="submit" className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-3 whitespace-nowrap">
                          Assign
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Teams</h2>
          {allTeams.length === 0 ? (
            <p className="text-gray-400 text-sm">No teams defined yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allTeams.map((team) => {
                const hasTeam = assignedTeamIds.has(team.id);
                return (
                  <div key={team.id} className={`flex items-center justify-between p-3 rounded-lg border ${hasTeam ? 'border-purple-200 bg-purple-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{team.name}</div>
                      {team.description && <div className="text-xs text-gray-500 mt-0.5">{team.description}</div>}
                    </div>
                    {hasTeam ? (
                      <form action={removeTeam.bind(null, user.id, team.id)}>
                        <button type="submit" className="text-xs text-red-600 hover:text-red-800 font-medium ml-3 whitespace-nowrap">
                          Remove
                        </button>
                      </form>
                    ) : (
                      <form action={assignTeam.bind(null, user.id, team.id)}>
                        <button type="submit" className="text-xs text-purple-600 hover:text-purple-800 font-medium ml-3 whitespace-nowrap">
                          Assign
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Audit log for this user */}
        {user.auditLogs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">When</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Action</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Resource</th>
                  </tr>
                </thead>
                <tbody>
                  {user.auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                        {log.createdAt.toLocaleString('en-GB')}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-gray-700">{log.action}</td>
                      <td className="py-2 px-3 text-gray-500">{log.resource ?? '—'}</td>
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
