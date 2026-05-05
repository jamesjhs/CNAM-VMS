import { requireAuth, hasCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb } from '@/lib/db';
import Link from 'next/link';
import { requestToJoinTeam } from './actions';

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const currentUser = await requireAuth();
  const { success } = await searchParams;
  const db = getDb();

  // Can this user directly view any team's detail page without being a member?
  const canReadAsAdmin = hasCapability(currentUser, 'admin:teams.read') || hasCapability(currentUser, 'admin:teams.write');

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

  const myTeams = allTeams.filter((t) => myTeamIds.has(t.id));
  const otherTeams = allTeams.filter((t) => !myTeamIds.has(t.id));

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Teams</h1>

        {success === 'requested' && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
            ✓ Your join request has been submitted. A team leader will review it.
          </div>
        )}

        {/* ── Teams I'm in ──────────────────────────────────────────────── */}
        {myTeams.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Teams I&apos;m in
            </h2>
            <div className="space-y-3">
              {myTeams.map((team) => {
                const leaders = leadersByTeam.get(team.id) ?? [];
                const activeTasks = taskCountMap.get(team.id) ?? 0;
                const unread = unreadCountMap.get(team.id) ?? 0;
                const memberCount = memberCountMap.get(team.id) ?? 0;

                return (
                  <div
                    key={team.id}
                    className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/teams/${team.id}`}
                        className="text-base font-semibold text-blue-700 hover:underline"
                      >
                        {team.name}
                      </Link>
                      {leaders.length > 0 && (
                        <p className="text-xs text-indigo-600 mt-0.5">
                          👤 {leaders.map((l) => l.name ?? l.email).join(', ')}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="text-xs text-gray-500">
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-500">
                          {activeTasks} task{activeTasks !== 1 ? 's' : ''}
                        </span>
                        {unread > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-white bg-blue-600 px-2 py-0.5 rounded-full">
                            💬 {unread > 9 ? '9+' : unread} unread
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/teams/${team.id}`}
                      className="shrink-0 text-sm text-gray-400 hover:text-blue-600 transition-colors"
                      aria-label={`Go to ${team.name}`}
                    >
                      →
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Teams I'm not in ──────────────────────────────────────────── */}
        {otherTeams.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Teams I&apos;m not in
            </h2>
            <div className="space-y-3">
              {otherTeams.map((team) => {
                const leaders = leadersByTeam.get(team.id) ?? [];
                const memberCount = memberCountMap.get(team.id) ?? 0;
                const isPending = joinRequestMap.get(team.id) === 'PENDING';

                return (
                  <div
                    key={team.id}
                    className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div className="flex-1 min-w-0">
                      {canReadAsAdmin ? (
                        <Link
                          href={`/teams/${team.id}`}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          {team.name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-gray-900">{team.name}</p>
                      )}
                      {team.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{team.description}</p>
                      )}
                      {leaders.length > 0 && (
                        <p className="text-xs text-indigo-600 mt-0.5">
                          👤 {leaders.map((l) => l.name ?? l.email).join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {memberCount} member{memberCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {canReadAsAdmin ? (
                        <Link
                          href={`/teams/${team.id}`}
                          className="text-sm text-gray-400 hover:text-blue-600 transition-colors"
                          aria-label={`View ${team.name}`}
                        >
                          →
                        </Link>
                      ) : isPending ? (
                        <span className="inline-block text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg font-medium cursor-default">
                          ⏳ Request Pending
                        </span>
                      ) : (
                        <form action={requestToJoinTeam.bind(null, team.id)}>
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
          </section>
        )}

        {/* ── No teams at all ───────────────────────────────────────────── */}
        {myTeams.length === 0 && otherTeams.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No teams have been created yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
