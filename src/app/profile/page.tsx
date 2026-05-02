import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackTs } from '@/lib/db';
import Link from 'next/link';
import { updateOwnProfile, addOwnPhone, removeOwnPhone, changePasswordFromProfile } from './actions';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const sessionUser = await requireAuth();

  const db = getDb();
  type UserRow = { id: string; email: string; name: string | null; status: string; accountType: string; createdAt: string };
  const rawUser = db.prepare('SELECT id, email, name, status, accountType, createdAt FROM users WHERE id = ?').get(sessionUser.id) as UserRow | undefined;
  if (!rawUser) return null;

  type PhoneRow = { id: string; number: string; label: string | null };
  const phones = db.prepare('SELECT id, number, label FROM user_phones WHERE userId = ? ORDER BY createdAt ASC').all(sessionUser.id) as PhoneRow[];

  type RoleRow = { roleId: string; roleName: string; roleDescription: string | null };
  const userRoles = (db.prepare(
    `SELECT ur.roleId, r.name as roleName, r.description as roleDescription
     FROM user_roles ur JOIN roles r ON r.id = ur.roleId WHERE ur.userId = ?`
  ).all(sessionUser.id) as RoleRow[]).map(r => ({ roleId: r.roleId, role: { name: r.roleName, description: r.roleDescription } }));

  type TeamRow = { teamId: string; teamName: string; teamDescription: string | null };
  const userTeams = (db.prepare(
    `SELECT ut.teamId, t.name as teamName, t.description as teamDescription
     FROM user_teams ut JOIN teams t ON t.id = ut.teamId WHERE ut.userId = ?`
  ).all(sessionUser.id) as TeamRow[]).map(t => ({ teamId: t.teamId, team: { name: t.teamName, description: t.teamDescription } }));

  const user = {
    ...rawUser,
    createdAt: unpackTs(rawUser.createdAt),
    phones,
    userRoles,
    userTeams,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">My Profile</h1>
          <p className="text-gray-500">Update your name, contact details, and general activity preferences.</p>
        </div>

        {/* Success Messages */}
        {success === 'PasswordChanged' && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
            <div className="flex items-start gap-3">
              <span className="text-lg">✓</span>
              <div>
                <strong className="block">Password changed successfully!</strong>
                <p className="text-sm mt-1">Your password has been updated. Please remember your new password for future logins.</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
            <div className="flex items-start gap-3">
              <span className="text-lg">⚠</span>
              <div>
                <strong className="block">
                  {error === 'MissingFields' && 'Please fill in all fields'}
                  {error === 'PasswordMismatch' && 'New passwords do not match'}
                  {error === 'TooShort' && 'New password must be at least 8 characters'}
                  {error === 'WrongCurrentPassword' && 'Your current password is incorrect'}
                  {error === 'NoPassword' && 'No password is set for this account. Contact your administrator'}
                  {!['MissingFields', 'PasswordMismatch', 'TooShort', 'WrongCurrentPassword', 'NoPassword'].includes(error) && 'Something went wrong. Please try again'}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* Account info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Account Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <span className="text-gray-500">Email:</span>{' '}
              <span className="font-medium">{user.email}</span>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>{' '}
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[user.status] ?? ''}`}>
                {user.status}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Account type:</span>{' '}
              <span className="font-medium capitalize">{user.accountType.toLowerCase()}</span>
            </div>
            <div>
              <span className="text-gray-500">Member since:</span>{' '}
              <span className="font-medium">{user.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>

          {/* Edit name */}
          <form
            action={async (formData: FormData) => {
              'use server';
              const name = formData.get('name') as string;
              await updateOwnProfile(name);
            }}
            className="flex flex-col sm:flex-row gap-3 mt-2"
          >
            <input
              name="name"
              type="text"
              defaultValue={user.name ?? ''}
              placeholder="Your full name"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              Save Name
            </button>
          </form>
        </div>

        {/* Phone numbers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Telephone Numbers</h2>
          {user.phones.length > 0 && (
            <ul className="mb-4 space-y-2">
              {user.phones.map((phone) => (
                <li key={phone.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div>
                    <span className="font-medium text-sm text-gray-900">{phone.number}</span>
                    {phone.label && <span className="ml-2 text-xs text-gray-500">({phone.label})</span>}
                  </div>
                  <form action={removeOwnPhone.bind(null, phone.id)}>
                    <button type="submit" className="text-xs text-red-600 hover:text-red-800 font-medium whitespace-nowrap">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form
            action={async (formData: FormData) => {
              'use server';
              const number = formData.get('number') as string;
              const label = formData.get('label') as string;
              await addOwnPhone(number, label);
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
        </div>

        {/* Security - Change Password */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Security</h2>
          <p className="text-sm text-gray-600 mb-4">Change your password to keep your account secure. Use a strong password of at least 8 characters.</p>

          <form action={changePasswordFromProfile} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Current password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New password
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Change Password
            </button>
          </form>
        </div>
        {user.userRoles.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">My Roles</h2>
            <div className="flex flex-wrap gap-2">
              {user.userRoles.map((ur) => (
                <div key={ur.roleId} className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-sm font-medium text-blue-800">{ur.role.name}</div>
                  {ur.role.description && <div className="text-xs text-blue-600">{ur.role.description}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity preferences shortcut */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Activity Preferences</h2>
            <p className="text-sm text-gray-500">
              Set the types of volunteering activities you are generally available for. These help coordinators
              understand your interests.
            </p>
          </div>
          <Link
            href="/volunteer/availability"
            className="shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            Edit preferences →
          </Link>
        </div>

        {/* Teams */}
        {user.userTeams.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">My Teams</h2>
            <div className="flex flex-wrap gap-2">
              {user.userTeams.map((ut) => (
                <div key={ut.teamId} className="px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="text-sm font-medium text-purple-800">{ut.team.name}</div>
                  {ut.team.description && <div className="text-xs text-purple-600">{ut.team.description}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Capabilities */}
        {sessionUser.capabilities.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">My Permissions</h2>
            <div className="flex flex-wrap gap-2">
              {sessionUser.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-mono"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
