import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackTs, unpackBool } from '@/lib/db';
import Link from 'next/link';
import { createTeam, deleteTeam, updateTeam } from '../users/actions';
import { toggleTeamLeader } from './actions';
import TeamCard from './TeamCard';

export default async function TeamsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireCapability('admin:teams.read');

  const { success, error } = await searchParams;

  const db = getDb();

  const rawTeams = db.prepare(
    'SELECT id, name, description, createdAt FROM teams ORDER BY name ASC',
  ).all() as { id: string; name: string; description: string | null; createdAt: string }[];

  const rawUserTeams = db.prepare(`
    SELECT ut.teamId, ut.userId, ut.isLeader,
           u.id as uid, u.name as uname, u.email as uemail
    FROM user_teams ut
    JOIN users u ON ut.userId = u.id
    ORDER BY ut.joinedAt ASC
  `).all() as {
    teamId: string; userId: string; isLeader: number;
    uid: string; uname: string | null; uemail: string;
  }[];

  const memberCountByTeam = new Map<string, number>();
  const membersByTeam = new Map<string, { userId: string; isLeader: boolean; user: { id: string; name: string | null; email: string } }[]>();
  for (const m of rawUserTeams) {
    if (!membersByTeam.has(m.teamId)) membersByTeam.set(m.teamId, []);
    membersByTeam.get(m.teamId)!.push({
      userId: m.userId,
      isLeader: unpackBool(m.isLeader),
      user: { id: m.uid, name: m.uname, email: m.uemail },
    });
    memberCountByTeam.set(m.teamId, (memberCountByTeam.get(m.teamId) ?? 0) + 1);
  }

  const taskCounts = db.prepare(
    'SELECT teamId, COUNT(*) as cnt FROM team_tasks GROUP BY teamId',
  ).all() as { teamId: string; cnt: number }[];
  const taskCountMap = new Map(taskCounts.map((t) => [t.teamId, t.cnt]));

  const teams = rawTeams.map((t) => ({
    ...t,
    createdAt: unpackTs(t.createdAt),
    userTeams: membersByTeam.get(t.id) ?? [],
    _count: {
      userTeams: memberCountByTeam.get(t.id) ?? 0,
      tasks: taskCountMap.get(t.id) ?? 0,
    },
  }));

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

        <div className="flex items-center justify-between mb-6">
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

        {/* Success / error banners */}
        {success === 'leader' && (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✓ Team admin updated.
          </div>
        )}
        {error === 'NotMember' && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            The selected user is not a member of this team.
          </div>
        )}

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
              <TeamCard
                key={team.id}
                team={team}
                updateTeamAction={async (id, name, description) => {
                  'use server';
                  await updateTeam(id, name, description);
                }}
                deleteTeamAction={async (id) => {
                  'use server';
                  await deleteTeam(id);
                }}
                toggleLeaderAction={async (teamId, userId) => {
                  'use server';
                  await toggleTeamLeader(teamId, userId);
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
