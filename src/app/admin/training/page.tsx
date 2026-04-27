import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackBool } from '@/lib/db';
import Link from 'next/link';
import { createTrainingPolicy, updateTrainingPolicy, deleteTrainingPolicy } from './actions';
import type { UserAccountType } from '@/lib/db-types';

const ACCOUNT_TYPE_LABELS: Record<UserAccountType, string> = {
  VOLUNTEER: 'Volunteer',
  STAFF: 'Staff',
  MEMBER: 'Member',
};

const ALL_ACCOUNT_TYPES: UserAccountType[] = ['VOLUNTEER', 'STAFF', 'MEMBER'];

export default async function TrainingAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireCapability('admin:training.write');

  const { edit: editId } = await searchParams;

  const db = getDb();
  const rawPolicies = db.prepare(`
    SELECT id, title, description, frequency, isActive
    FROM training_policies
    ORDER BY isActive DESC, title ASC
  `).all() as {
    id: string; title: string; description: string | null; frequency: string | null; isActive: number;
  }[];

  const rawAssignments = db.prepare(
    'SELECT trainingPolicyId, accountType FROM training_policy_roles',
  ).all() as { trainingPolicyId: string; accountType: string }[];

  const assignmentsByPolicy = new Map<string, Set<string>>();
  for (const a of rawAssignments) {
    if (!assignmentsByPolicy.has(a.trainingPolicyId)) {
      assignmentsByPolicy.set(a.trainingPolicyId, new Set());
    }
    assignmentsByPolicy.get(a.trainingPolicyId)!.add(a.accountType);
  }

  const policies = rawPolicies.map((p) => ({
    ...p,
    isActive: unpackBool(p.isActive),
    roleAssignments: Array.from(assignmentsByPolicy.get(p.id) ?? []).map((accountType) => ({ accountType })),
  }));

  const editPolicy = editId ? policies.find((p) => p.id === editId) ?? null : null;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Training Policies</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Training Policy Matrix</h1>
            <p className="text-gray-500">
              Define training and compliance requirements. Assign each policy to one or more account types (Volunteer, Staff, Member).
            </p>
          </div>
          <span className="text-sm text-gray-400">{policies.length} polic{policies.length !== 1 ? 'ies' : 'y'}</span>
        </div>

        {/* Add / Edit Policy Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">
            {editPolicy ? `Edit: ${editPolicy.title}` : 'Add Training Policy'}
          </h2>
          <form
            action={async (formData: FormData) => {
              'use server';
              const title = formData.get('title') as string;
              const description = formData.get('description') as string;
              const frequency = formData.get('frequency') as string;
              const accountTypes = ALL_ACCOUNT_TYPES.filter(
                (t) => formData.get(`type_${t}`) === 'on',
              );
              if (editPolicy) {
                const isActive = formData.get('isActive') === 'on';
                await updateTrainingPolicy(editPolicy.id, title, description, frequency, isActive, accountTypes);
              } else {
                await createTrainingPolicy(title, description, frequency, accountTypes);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Policy title *</label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editPolicy?.title ?? ''}
                  placeholder="e.g. First Aid Certificate"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Frequency / renewal period</label>
                <input
                  name="frequency"
                  type="text"
                  defaultValue={editPolicy?.frequency ?? ''}
                  placeholder="e.g. Annual, Every 3 years, One-off"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                name="description"
                rows={2}
                defaultValue={editPolicy?.description ?? ''}
                placeholder="Optional details about this training requirement"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Applies to account types</p>
              <div className="flex flex-wrap gap-4">
                {ALL_ACCOUNT_TYPES.map((t) => {
                  const checked = editPolicy
                    ? editPolicy.roleAssignments.some((r) => r.accountType === t)
                    : false;
                  return (
                    <label key={t} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name={`type_${t}`}
                        defaultChecked={checked}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {ACCOUNT_TYPE_LABELS[t]}
                    </label>
                  );
                })}
              </div>
            </div>

            {editPolicy && (
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editPolicy.isActive}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Policy is active
                </label>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {editPolicy ? 'Save changes' : 'Add policy'}
              </button>
              {editPolicy && (
                <Link
                  href="/admin/training"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </Link>
              )}
            </div>
          </form>
        </div>

        {/* Policy matrix table */}
        {policies.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-gray-500">No training policies yet. Add one above.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Policy</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Frequency</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">Volunteer</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">Staff</th>
                    <th className="text-center py-3 px-4 text-gray-500 font-medium">Member</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {policies.map((policy) => {
                    const assignedTypes = new Set(policy.roleAssignments.map((r) => r.accountType));
                    return (
                      <tr key={policy.id} className={`hover:bg-gray-50 transition-colors ${!policy.isActive ? 'opacity-60' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{policy.title}</div>
                          {policy.description && (
                            <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{policy.description}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {policy.frequency ?? <span className="italic text-gray-300">—</span>}
                        </td>
                        {ALL_ACCOUNT_TYPES.map((t) => (
                          <td key={t} className="py-3 px-4 text-center">
                            {assignedTypes.has(t) ? (
                              <span className="text-green-600 font-bold text-base" title="Required">✓</span>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        ))}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${policy.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                            {policy.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/admin/training?edit=${policy.id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                            >
                              Edit
                            </Link>
                            <form action={deleteTrainingPolicy.bind(null, policy.id)}>
                              <button
                                type="submit"
                                className="text-red-600 hover:text-red-800 font-medium text-sm"
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
