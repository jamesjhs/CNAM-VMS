import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { createTeam, deleteTeam, updateTeam } from '../users/actions';
import { setTeamLeader } from './actions';

export default async function TeamsAdminPage() {
  await requireCapability('admin:teams.read');

  const teams = await prisma.team.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { userTeams: true, tasks: true } },
      leader: { select: { id: true, name: true, email: true } },
      userTeams: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Teams</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Team Management</h1>
            <p className="text-gray-500">Create and manage volunteer teams.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/teams/tasks"
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Task Forms
            </Link>
            <span className="text-sm text-gray-500">{teams.length} team{teams.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Create new team form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">Create New Team</h2>
          <form
            action={async (formData: FormData) => {
              'use server';
              const name = formData.get('name') as string;
              const description = formData.get('description') as string;
              await createTeam(name, description);
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              name="name"
              type="text"
              required
              placeholder="Team name (e.g. Aircraft Restoration)"
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
              Create Team
            </button>
          </form>
        </div>

        {/* Teams list */}
        {teams.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No teams defined yet. Create your first team above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => (
              <div key={team.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{team.name}</h3>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {team._count.userTeams} member{team._count.userTeams !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {team._count.tasks} task{team._count.tasks !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {team.description && (
                      <p className="text-gray-500 text-sm">{team.description}</p>
                    )}
                    {team.leader && (
                      <p className="text-sm text-indigo-600 mt-1">
                        👤 Leader: {team.leader.name ?? team.leader.email}
                      </p>
                    )}
                    <p className="text-gray-400 text-xs mt-1">Created {team.createdAt.toLocaleDateString('en-GB')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form
                      action={async (formData: FormData) => {
                        'use server';
                        const name = formData.get('name') as string;
                        const description = formData.get('description') as string;
                        await updateTeam(team.id, name, description);
                      }}
                      className="flex gap-2"
                    >
                      <input
                        name="name"
                        type="text"
                        required
                        defaultValue={team.name}
                        placeholder="Team name"
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                      />
                      <input
                        name="description"
                        type="text"
                        defaultValue={team.description ?? ''}
                        placeholder="Description"
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 hidden sm:block"
                      />
                      <button
                        type="submit"
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                      >
                        Save
                      </button>
                    </form>
                    <Link
                      href={`/teams/${team.id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors whitespace-nowrap"
                    >
                      View page
                    </Link>
                    <form action={deleteTeam.bind(null, team.id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors whitespace-nowrap"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>

                {/* Team leader assignment */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Team Leader</p>
                  <form
                    action={async (fd: FormData) => {
                      'use server';
                      const leaderId = (fd.get('leaderId') as string | null) || null;
                      await setTeamLeader(team.id, leaderId);
                    }}
                    className="flex gap-2 flex-wrap"
                  >
                    <select
                      name="leaderId"
                      defaultValue={team.leader?.id ?? ''}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">No leader</option>
                      {team.userTeams.map(({ user }) => (
                        <option key={user.id} value={user.id}>
                          {user.name ?? user.email}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Set leader
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
