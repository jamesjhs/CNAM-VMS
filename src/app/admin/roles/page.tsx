import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackBool } from '@/lib/db';
import Link from 'next/link';
import { createRole, assignCapabilityToRole, removeCapabilityFromRole } from '../users/actions';

export default async function RolesAdminPage() {
  await requireCapability('admin:roles.read');

  const db = getDb();

  const rawRoles = db.prepare(
    'SELECT id, name, description, isSystem FROM roles ORDER BY name ASC',
  ).all() as { id: string; name: string; description: string | null; isSystem: number }[];

  const rawRoleCaps = db.prepare(`
    SELECT rc.roleId, rc.capabilityId, c.key, c.description
    FROM role_capabilities rc
    JOIN capabilities c ON rc.capabilityId = c.id
  `).all() as { roleId: string; capabilityId: string; key: string; description: string | null }[];

  const userRoleCounts = db.prepare(
    'SELECT roleId, COUNT(*) as cnt FROM user_roles GROUP BY roleId',
  ).all() as { roleId: string; cnt: number }[];
  const userRoleCountMap = new Map(userRoleCounts.map((r) => [r.roleId, r.cnt]));

  const allCapabilities = db.prepare(
    'SELECT id, key, description FROM capabilities ORDER BY key ASC',
  ).all() as { id: string; key: string; description: string | null }[];

  const capsByRole = new Map<string, typeof rawRoleCaps>();
  for (const rc of rawRoleCaps) {
    if (!capsByRole.has(rc.roleId)) capsByRole.set(rc.roleId, []);
    capsByRole.get(rc.roleId)!.push(rc);
  }

  const roles = rawRoles.map((r) => ({
    ...r,
    isSystem: unpackBool(r.isSystem),
    roleCapabilities: capsByRole.get(r.id) ?? [],
    _count: { userRoles: userRoleCountMap.get(r.id) ?? 0 },
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Roles</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Roles Management</h1>
            <p className="text-gray-500">Define roles and assign capabilities to control access.</p>
          </div>
        </div>

        {/* Create new role form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">Create New Role</h2>
          <form
            action={async (formData: FormData) => {
              'use server';
              const name = formData.get('name') as string;
              const description = formData.get('description') as string;
              await createRole(name, description);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              name="name"
              type="text"
              required
              placeholder="Role name (e.g. Team Leader)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              name="description"
              type="text"
              placeholder="Description (optional)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              Create Role
            </button>
          </form>
        </div>

        {/* Roles list */}
        {roles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No roles defined yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {roles.map((role) => {
              const assignedCapIds = new Set(role.roleCapabilities.map((rc) => rc.capabilityId));
              return (
                <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{role.name}</h3>
                        {role.isSystem && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            system
                          </span>
                        )}
                      </div>
                      {role.description && <p className="text-gray-500 text-sm mt-0.5">{role.description}</p>}
                      <p className="text-gray-400 text-xs mt-1">{role._count.userRoles} user{role._count.userRoles !== 1 ? 's' : ''} assigned</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Capabilities</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {allCapabilities.map((cap) => {
                        const hasCap = assignedCapIds.has(cap.id);
                        return (
                          <div key={cap.id} className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${hasCap ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                            <div>
                              <span className="font-mono text-gray-800">{cap.key}</span>
                              {cap.description && <span className="text-gray-500 ml-2">— {cap.description}</span>}
                            </div>
                            {hasCap ? (
                              <form action={removeCapabilityFromRole.bind(null, role.id, cap.id)}>
                                <button type="submit" className="text-red-600 hover:text-red-800 font-medium ml-2 whitespace-nowrap">
                                  Remove
                                </button>
                              </form>
                            ) : (
                              <form action={assignCapabilityToRole.bind(null, role.id, cap.id)}>
                                <button type="submit" className="text-blue-600 hover:text-blue-800 font-medium ml-2 whitespace-nowrap">
                                  Add
                                </button>
                              </form>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
