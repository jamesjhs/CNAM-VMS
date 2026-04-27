import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackBool } from '@/lib/db';
import Link from 'next/link';
import type { TaskUrgency } from '@/lib/db-types';

const URGENCY_COLOURS: Record<TaskUrgency, string> = {
  ROUTINE: 'bg-green-100 text-green-800',
  MODERATE: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-red-100 text-red-800',
};

const URGENCY_LABELS: Record<TaskUrgency, string> = {
  ROUTINE: 'Routine',
  MODERATE: 'Moderate',
  URGENT: 'Urgent',
};

export default async function TeamsPage() {
  await requireAuth();

  const db = getDb();

  const rawTeams = db.prepare('SELECT id, name, description FROM teams ORDER BY name ASC').all() as {
    id: string; name: string; description: string | null;
  }[];

  const rawLeaders = db.prepare(`
    SELECT ut.teamId, ut.userId, ut.isLeader, u.name as uname, u.email as uemail
    FROM user_teams ut
    JOIN users u ON ut.userId = u.id
    WHERE ut.isLeader = 1
  `).all() as { teamId: string; userId: string; isLeader: number; uname: string | null; uemail: string }[];

  const memberCounts = db.prepare(
    'SELECT teamId, COUNT(*) as cnt FROM user_teams GROUP BY teamId',
  ).all() as { teamId: string; cnt: number }[];
  const memberCountMap = new Map(memberCounts.map((m) => [m.teamId, m.cnt]));

  const rawTasks = db.prepare(`
    SELECT id, teamId, title, taskType, urgency, description, personnelRequired, supervisorRequired
    FROM team_tasks
    WHERE isActive = 1
    ORDER BY CASE urgency WHEN 'URGENT' THEN 0 WHEN 'MODERATE' THEN 1 ELSE 2 END ASC, createdAt DESC
  `).all() as {
    id: string; teamId: string; title: string; taskType: string; urgency: string;
    description: string | null; personnelRequired: number | null; supervisorRequired: number;
  }[];

  const leadersByTeam = new Map<string, { user: { name: string | null; email: string } }[]>();
  for (const l of rawLeaders) {
    if (!leadersByTeam.has(l.teamId)) leadersByTeam.set(l.teamId, []);
    leadersByTeam.get(l.teamId)!.push({ user: { name: l.uname, email: l.uemail } });
  }

  const tasksByTeam = new Map<string, typeof rawTasks>();
  for (const t of rawTasks) {
    if (!tasksByTeam.has(t.teamId)) tasksByTeam.set(t.teamId, []);
    tasksByTeam.get(t.teamId)!.push(t);
  }

  const urgencyOrder: Record<TaskUrgency, number> = { URGENT: 0, MODERATE: 1, ROUTINE: 2 };

  const teams = rawTeams.map((team) => ({
    ...team,
    userTeams: leadersByTeam.get(team.id) ?? [],
    tasks: tasksByTeam.get(team.id) ?? [],
    _count: { userTeams: memberCountMap.get(team.id) ?? 0 },
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Teams</h1>
          <p className="text-gray-500">Overview of all teams and their active tasks.</p>
        </div>

        {teams.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No teams have been set up yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {teams.map((team) => {
              const sortedTasks = [...team.tasks].sort(
                (a, b) => urgencyOrder[a.urgency as TaskUrgency] - urgencyOrder[b.urgency as TaskUrgency],
              );
              return (
                <div key={team.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Team header */}
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{team.name}</h2>
                      {team.description && (
                        <p className="text-sm text-gray-500">{team.description}</p>
                      )}
                      {team.userTeams.length > 0 && (
                        <p className="text-sm text-indigo-600 mt-0.5">
                          👤 {team.userTeams.map((m) => m.user.name ?? m.user.email).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        {team._count.userTeams} member{team._count.userTeams !== 1 ? 's' : ''}
                      </span>
                      <Link
                        href={`/teams/${team.id}`}
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-colors"
                      >
                        Team page →
                      </Link>
                    </div>
                  </div>

                  {/* Tasks summary */}
                  {sortedTasks.length === 0 ? (
                    <div className="px-6 py-4 text-sm text-gray-400">No active tasks for this team.</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {sortedTasks.map((task) => (
                        <div key={task.id} className="px-6 py-4 flex items-start gap-3">
                          <span className={`mt-0.5 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${URGENCY_COLOURS[task.urgency as TaskUrgency]}`}>
                            {URGENCY_LABELS[task.urgency as TaskUrgency]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{task.title}</p>
                            {task.description && (
                              <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-400">{task.taskType}</span>
                              {task.personnelRequired && (
                                <span className="text-xs text-gray-400">👷 {task.personnelRequired} personnel</span>
                              )}
                              {unpackBool(task.supervisorRequired) && (
                                <span className="text-xs text-amber-600">⚠️ Supervisor needed</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
