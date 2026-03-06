import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import { updateOwnProfile, addOwnPhone, removeOwnPhone } from './actions';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
};

export default async function ProfilePage() {
  const sessionUser = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      phones: { orderBy: { createdAt: 'asc' } },
      userRoles: { include: { role: { select: { name: true, description: true } } } },
      userTeams: { include: { team: { select: { name: true, description: true } } } },
    },
  });

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">My Profile</h1>
          <p className="text-gray-500">Update your name and contact details.</p>
        </div>

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

        {/* Roles */}
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
