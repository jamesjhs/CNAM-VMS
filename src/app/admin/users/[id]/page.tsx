import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackTs } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  updateUserStatus,
  updateUserProfile,
  addUserPhone,
  removeUserPhone,
  assignRole,
  removeRole,
  assignTeam,
  removeTeam,
  adminSendPasswordReset,
  resetUserLockout,
} from '../actions';
import DeleteUserButton from './DeleteUserButton';
import type { UserStatus } from '@/lib/db-types';

const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
};

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const actor = await requireCapability('admin:users.read');
  const canWrite = actor.capabilities.includes('admin:users.write');

  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();

  const rawUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as {
    id: string; email: string; name: string | null; status: string;
    createdAt: string; updatedAt: string; mustChangePassword: number;
  } | undefined;

  if (!rawUser) notFound();

  const user = {
    ...rawUser,
    status: rawUser.status as UserStatus,
    createdAt: unpackTs(rawUser.createdAt),
  };

  const rawUserRoles = db.prepare(`
    SELECT ur.roleId, r.name as roleName, r.description as roleDescription
    FROM user_roles ur
    JOIN roles r ON ur.roleId = r.id
    WHERE ur.userId = ?
  `).all(id) as { roleId: string; roleName: string; roleDescription: string | null }[];

  const rawUserTeams = db.prepare(`
    SELECT ut.teamId, t.name as teamName, t.description as teamDescription
    FROM user_teams ut
    JOIN teams t ON ut.teamId = t.id
    WHERE ut.userId = ?
  `).all(id) as { teamId: string; teamName: string; teamDescription: string | null }[];

  const phones = db.prepare(
    'SELECT id, number, label FROM user_phones WHERE userId = ? ORDER BY createdAt ASC',
  ).all(id) as { id: string; number: string; label: string | null }[];

  const rawAuditLogs = db.prepare(
    'SELECT id, action, resource, createdAt FROM audit_logs WHERE userId = ? ORDER BY createdAt DESC LIMIT 10',
  ).all(id) as { id: string; action: string; resource: string | null; createdAt: string }[];

  const auditLogs = rawAuditLogs.map((l) => ({ ...l, createdAt: unpackTs(l.createdAt) }));

  const { n: userLockoutCount } = db.prepare(
    'SELECT COUNT(*) as n FROM verification_tokens WHERE identifier = ? AND expires > ?',
  ).get(`pw-fail:${user.email}`, new Date().toISOString()) as { n: number };

  const isLockedOut = userLockoutCount >= 10;

  const allRoles = db.prepare('SELECT id, name, description FROM roles ORDER BY name ASC').all() as {
    id: string; name: string; description: string | null;
  }[];

  const allTeams = db.prepare('SELECT id, name, description FROM teams ORDER BY name ASC').all() as {
    id: string; name: string; description: string | null;
  }[];

  const assignedRoleIds = new Set(rawUserRoles.map((ur) => ur.roleId));
  const assignedTeamIds = new Set(rawUserTeams.map((ut) => ut.teamId));

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

        {/* Success/Error messages */}
        {sp.success === 'PasswordResetSent' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <span className="text-green-600 text-xl flex-shrink-0">✓</span>
            <div>
              <p className="font-medium text-green-900">Password reset email sent</p>
              <p className="text-sm text-green-800 mt-0.5">An email with password reset instructions has been sent to <strong>{user.email}</strong>. The link will expire in 24 hours.</p>
            </div>
          </div>
        )}

        {sp.error === 'CannotDeleteSelf' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <span className="text-red-600 text-xl flex-shrink-0">✕</span>
            <p className="text-sm text-red-800 font-medium">You cannot delete your own account from the admin panel. Use your profile settings instead.</p>
          </div>
        )}

        {sp.error === 'CannotDeleteRoot' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <span className="text-red-600 text-xl flex-shrink-0">✕</span>
            <p className="text-sm text-red-800 font-medium">The root administrator account cannot be deleted.</p>
          </div>
        )}

        {/* User header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{user.name ?? <span className="text-gray-400 italic">No name set</span>}</h1>
              <p className="text-gray-500 mt-0.5">{user.email}</p>
              <p className="text-gray-400 text-xs mt-1">Member since {user.createdAt.toLocaleDateString('en-GB')}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${STATUS_STYLES[user.status]}`}>
                {user.status}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Profile */}
        {canWrite && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Edit Profile</h2>
          <form
            action={async (formData: FormData) => {
              'use server';
              const name = formData.get('name') as string;
              const email = formData.get('email') as string;
              await updateUserProfile(user.id, name, email);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
                <input
                  name="name"
                  type="text"
                  defaultValue={user.name ?? ''}
                  placeholder="Full name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email Address</label>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={user.email ?? ''}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Save Changes
            </button>
          </form>
        </div>
        )}

        {/* Phone Numbers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Telephone Numbers</h2>
          {phones.length > 0 && (
            <ul className="mb-4 space-y-2">
              {phones.map((phone) => (
                <li key={phone.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div>
                    <span className="font-medium text-sm text-gray-900">{phone.number}</span>
                    {phone.label && <span className="ml-2 text-xs text-gray-500">({phone.label})</span>}
                  </div>
                  {canWrite && (
                  <form action={removeUserPhone.bind(null, user.id, phone.id)}>
                    <button type="submit" className="text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap">
                      Remove
                    </button>
                  </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canWrite && (
          <form
            action={async (formData: FormData) => {
              'use server';
              const number = formData.get('number') as string;
              const label = formData.get('label') as string;
              await addUserPhone(user.id, number, label);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              name="number"
              type="tel"
              required
              placeholder="Telephone number"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              name="label"
              type="text"
              placeholder="Label (e.g. Mobile, Home)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              Add Number
            </button>
          </form>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Status management */}
          {canWrite && (
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
          )}

          {/* Delete user — only available to write-capable admins; not for own account */}
          {canWrite && actor.id !== user.id && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Danger Zone</h2>
            <p className="text-gray-500 text-sm mb-4">
              Permanently delete this user account and all associated data. This cannot be undone.
            </p>
            <DeleteUserButton userId={user.id} userEmail={user.email ?? ''} />
          </div>
          )}
        </div>

        {/* Password & Security — write access only */}
        {canWrite && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">Password &amp; Security</h2>

          {/* Lockout status */}
          {isLockedOut ? (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-700">🔒 Account locked out</p>
                <p className="text-xs text-red-500 mt-0.5">
                  Too many failed sign-in attempts ({userLockoutCount}/10). Lockout clears automatically after 15 minutes.
                </p>
              </div>
              <form action={resetUserLockout.bind(null, user.id)}>
                <button
                  type="submit"
                  className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                >
                  Clear lockout
                </button>
              </form>
            </div>
          ) : userLockoutCount > 0 ? (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-4">
              <p className="text-xs text-amber-700">
                ⚠️ {userLockoutCount} recent failed sign-in attempt{userLockoutCount !== 1 ? 's' : ''} (max 10 before lockout).
              </p>
              <form action={resetUserLockout.bind(null, user.id)}>
                <button
                  type="submit"
                  className="text-xs border border-amber-400 text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                >
                  Clear attempts
                </button>
              </form>
            </div>
          ) : null}

          {/* Send password reset email */}
          <p className="text-gray-500 text-sm mb-4">
            Send a password reset link to this user&apos;s email address. The link is valid for 24 hours.
          </p>
          <form action={adminSendPasswordReset.bind(null, user.id)}>
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Send password reset email
            </button>
          </form>
        </div>
        )}

        {/* Roles */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Roles</h2>
          {allRoles.length === 0 ? (
            <p className="text-gray-400 text-sm">No roles defined yet. {canWrite && <Link href="/admin/roles" className="text-blue-600 hover:underline">Create roles →</Link>}</p>
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
                    {canWrite && (hasRole ? (
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
                    ))}
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
                    {canWrite && (hasTeam ? (
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
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Audit log for this user */}
        {auditLogs.length > 0 && (
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
                  {auditLogs.map((log) => (
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
