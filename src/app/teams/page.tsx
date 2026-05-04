import { requireAuth, hasCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackBool } from '@/lib/db';
import Link from 'next/link';
import type { TaskUrgency } from '@/lib/db-types';
import { requestToJoinTeam } from './actions';

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

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const currentUser = await requireAuth();
  const { success } = await searchParams;
  const db = getDb();
  const isAdmin = hasCapability(currentUser, 'admin:teams.read');

  // All teams
  const allTeams = db.prepare('SELECT id, name, description FROM teams ORDER BY name ASC').all() as {
    id: string; name: string; description: string | null;
  }[];

  // User's team memberships
  const myTeamIds = new Set(
    (db.prepare('SELECT teamId FROM user_teams WHERE userId = ?').all(currentUser.id) as { teamId: string }[])
      .map((r) => r.teamId),
  );

  // Leaders per team
  const rawLeaders = db.prepare(`
    SELECT ut.teamId, u.name as uname, u.email as uemail
    FROM user_teams ut
    JOIN users u ON ut.userId = u.id
    WHERE ut.isLeader = 1
  `).all() as { teamId: string; uname: string | null; uemail: string }[];
  const leadersByTeam = new Map<string, { name: string | null; email: string }[]>();
  for (const l of rawLeaders) {
    if (!leadersByTeam.has(l.teamId)) leadersByTeam.set(l.teamId, []);
    leadersByTeam.get(l.teamId)!.push({ name: l.uname, email: l.uemail });
  }

  // Active task counts per team
  const taskCounts = db.prepare(
    'SELECT teamId, COUNT(*) as cnt FROM team_tasks WHERE isActive = 1 GROUP BY teamId',
  ).all() as { teamId: string; cnt: number }[];
  const taskCountMap = new Map(taskCounts.map((t) => [t.teamId, t.cnt]));

  // Unread message counts for teams the user is a member of
  const unreadRows = db.prepare(`
    SELECT m.teamId, COUNT(*) as unreadCount
    FROM messages m
    LEFT JOIN message_reads mr
      ON mr.userId = ? AND mr.context = ('team:' || m.teamId)
    WHERE m.teamId IN (SELECT teamId FROM user_teams WHERE userId = ?)
      AND m.senderId != ?
      AND m.isDeleted = 0
      AND m.createdAt > COALESCE(mr.lastReadAt, '1970-01-01T00:00:00.000Z')
    GROUP BY m.teamId
  `).all(currentUser.id, currentUser.id, currentUser.id) as { teamId: string; unreadCount: number }[];
  const unreadCountMap = new Map(unreadRows.map((r) => [r.teamId, r.unreadCount]));

  // Member counts per team
  const memberCounts = db.prepare(
    'SELECT teamId, COUNT(*) as cnt FROM user_teams GROUP BY teamId',
  ).all() as { teamId: string; cnt: number }[];
  const memberCountMap = new Map(memberCounts.map((m) => [m.teamId, m.cnt]));

  // Join request status for non-member teams
  const joinRequestRows = db.prepare(
    `SELECT teamId, status FROM team_join_requests WHERE userId = ?`,
  ).all(currentUser.id) as { teamId: string; status: string }[];
  const joinRequestMap = new Map(joinRequestRows.map((r) => [r.teamId, r.status]));

  // Active tasks for preview (my teams only)
  const rawTasks = db.prepare(`
    SELECT id, teamId, title, taskType, urgency, description, personnelRequired, supervisorRequired
    FROM team_tasks
    WHERE isActive = 1
    ORDER BY CASE urgency WHEN 'URGENT' THEN 0 WHEN 'MODERATE' THEN 1 ELSE 2 END ASC, createdAt DESC
  `).all() as {
    id: string; teamId: string; title: string; taskType: string; urgency: string;
    description: string | null; personnelRequired: number | null; supervisorRequired: number;
  }[];
  const tasksByTeam = new Map<string, typeof rawTasks>();
  for (const t of rawTasks) {
    if (!tasksByTeam.has(t.teamId)) tasksByTeam.set(t.teamId, []);
    tasksByTeam.get(t.teamId)!.push(t);
  }

  // Admins with admin:teams.read see all teams in the "my teams" section
  const myTeams = allTeams.filter((t) => myTeamIds.has(t.id) || isAdmin);
  const otherTeams = isAdmin ? [] : allTeams.filter((t) => !myTeamIds.has(t.id));

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Teams</h1>
          <p className="text-gray-500">Overview of your teams and their active tasks.</p>
        </div>

        {success === 'requested' && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
            ✓ Your join request has been submitted. A team leader will review it.
          </div>
        )}

        {/* ── My Teams ─────────────────────────────────────────────────── */}
        {myTeams.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mb-8">
            <p className="text-gray-500">You are not a member of any team yet.</p>
          </div>
        ) : (
          <div className="space-y-8 mb-10">
            {myTeams.map((team) => {
              const leaders = leadersByTeam.get(team.id) ?? [];
              const activeTasks = taskCountMap.get(team.id) ?? 0;
              const unread = unreadCountMap.get(team.id) ?? 0;
              const memberCount = memberCountMap.get(team.id) ?? 0;
              const sortedTasks = [...(tasksByTeam.get(team.id) ?? [])].sort(
                (a, b) =>
                  ({ URGENT: 0, MODERATE: 1, ROUTINE: 2 }[a.urgency as TaskUrgency] ?? 2) -
                  ({ URGENT: 0, MODERATE: 1, ROUTINE: 2 }[b.urgency as TaskUrgency] ?? 2),
              );

              return (
                <div key={team.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Team header */}
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{team.name}</h2>
                      {team.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{team.description}</p>
                      )}
                      {leaders.length > 0 && (
                        <p className="text-sm text-indigo-600 mt-0.5">
                          👤 {leaders.map((l) => l.name ?? l.email).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                        {memberCount} member{memberCount !== 1 ? 's' : ''}
                      </span>
                      {activeTasks > 0 && (
                        <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          {activeTasks} active task{activeTasks !== 1 ? 's' : ''}
                        </span>
                      )}
                      {unread > 0 && (
                        <span
                          aria-label={`${unread} unread message${unread !== 1 ? 's' : ''}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-white bg-blue-600 px-2 py-0.5 rounded-full"
                        >
                          💬 {unread > 9 ? '9+' : unread} unread
                        </span>
                      )}
                      <Link
                        href={`/teams/${team.id}`}
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
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

        {/* ── Other Teams (collapsed) ───────────────────────────────────── */}
        {otherTeams.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer select-none list-none flex items-center justify-between bg-white rounded-xl border border-gray-200 px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium text-gray-700">
                  Other Teams ({otherTeams.length})
                </span>
              </div>
              <span className="text-xs text-gray-400">Teams you can request to join</span>
            </summary>

            <div className="mt-3 space-y-3">
              {otherTeams.map((team) => {
                const leaders = leadersByTeam.get(team.id) ?? [];
                const memberCount = memberCountMap.get(team.id) ?? 0;
                const activeTasks = taskCountMap.get(team.id) ?? 0;
                const requestStatus = joinRequestMap.get(team.id);
                const isPending = requestStatus === 'PENDING';

                return (
                  <div
                    key={team.id}
                    className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{team.name}</h3>
                      {team.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{team.description}</p>
                      )}
                      {leaders.length > 0 && (
                        <p className="text-xs text-indigo-600 mt-0.5">
                          👤 {leaders.map((l) => l.name ?? l.email).join(', ')}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </span>
                        {activeTasks > 0 && (
                          <span className="text-xs text-gray-400">
                            {activeTasks} active task{activeTasks !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isPending ? (
                        <span className="inline-block text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg font-medium cursor-default">
                          ⏳ Request Pending
                        </span>
                      ) : (
                        <form
                          action={async () => {
                            'use server';
                            await requestToJoinTeam(team.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="text-sm bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 hover:border-blue-400 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
                          >
                            Request to Join
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
