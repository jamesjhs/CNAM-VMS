import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { getDb, unpackTs, unpackBool, unpackDate } from '@/lib/db';
import { EVENT_TYPE_BG, EVENT_TYPE_LABELS, fmtMonth, dateToParam } from '@/lib/calendar';

export default async function DashboardPage() {
  const user = await requireAuth();

  const db = getDb();
  const now = new Date();
  const todayStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  const in30dStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30))
    .toISOString()
    .slice(0, 10);

  const rawAnnouncements = db.prepare(`
    SELECT id, title, pinned, createdAt
    FROM announcements
    ORDER BY pinned DESC, createdAt DESC
    LIMIT 3
  `).all() as { id: string; title: string; pinned: number; createdAt: string }[];

  const announcements = rawAnnouncements.map((a) => ({
    ...a,
    pinned: unpackBool(a.pinned),
    createdAt: unpackTs(a.createdAt),
  }));

  const rawUpcomingEvents = db.prepare(`
    SELECT ce.id, ce.title, ce.date, ce.startTime, ce.eventType,
           j.title as job_title, j.colour as job_colour,
           COUNT(es.id) as signupCount
    FROM calendar_events ce
    LEFT JOIN jobs j ON ce.jobId = j.id
    LEFT JOIN event_signups es ON es.eventId = ce.id
    WHERE ce.date >= ? AND ce.date < ?
    GROUP BY ce.id
    ORDER BY ce.date ASC, ce.startTime ASC
    LIMIT 5
  `).all(todayStr, in30dStr) as {
    id: string; title: string; date: string; startTime: string | null; eventType: string;
    job_title: string | null; job_colour: string | null; signupCount: number;
  }[];

  const upcomingEvents = rawUpcomingEvents.map((ev) => ({
    ...ev,
    date: unpackDate(ev.date)!,
    job: ev.job_title ? { title: ev.job_title, colour: ev.job_colour } : null,
    _count: { signups: ev.signupCount },
  }));

  const mySignupIds = db.prepare(`
    SELECT es.eventId
    FROM event_signups es
    JOIN calendar_events ce ON es.eventId = ce.id
    WHERE es.userId = ? AND ce.date >= ? AND ce.date < ?
  `).all(user.id, todayStr, in30dStr) as { eventId: string }[];
  const mySignupSet = new Set(mySignupIds.map((s) => s.eventId));

  // Get teams for this user
  const rawUserTeams = db.prepare(`
    SELECT ut.teamId, t.id as tid, t.name as tname
    FROM user_teams ut
    JOIN teams t ON ut.teamId = t.id
    WHERE ut.userId = ?
    ORDER BY ut.joinedAt ASC
  `).all(user.id) as { teamId: string; tid: string; tname: string }[];

  const myTeams: {
    team: {
      id: string; name: string;
      userTeams: { user: { name: string | null; email: string } }[];
      tasks: { id: string; urgency: string }[];
    };
  }[] = [];

  for (const ut of rawUserTeams) {
    const teamLeaders = db.prepare(`
      SELECT u.name, u.email
      FROM user_teams tut
      JOIN users u ON tut.userId = u.id
      WHERE tut.teamId = ? AND tut.isLeader = 1
    `).all(ut.teamId) as { name: string | null; email: string }[];

    const teamTasks = db.prepare(
      'SELECT id, urgency FROM team_tasks WHERE teamId = ? AND isActive = 1',
    ).all(ut.teamId) as { id: string; urgency: string }[];

    myTeams.push({
      team: {
        id: ut.tid,
        name: ut.tname,
        userTeams: teamLeaders.map((l) => ({ user: { name: l.name, email: l.email } })),
        tasks: teamTasks,
      },
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back{user.name ? `, ${user.name}` : ''}
        </h1>
        <p className="text-gray-500 mb-8">Here&apos;s your volunteer dashboard.</p>

        {user.status !== 'ACTIVE' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
            <strong>Account Pending:</strong> Your account is awaiting approval. Some features may be limited.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <DashCard title="Schedule &amp; Availability" icon="📅" href="/schedule" description="Browse events, sign up for shifts, record your availability, and choose what you can help with." />
          <DashCard title="Team Tasks" icon="✅" href="/teams" description="View active tasks across all teams, urgency levels, and requirements." />
          <DashCard title="Files &amp; Documents" icon="📁" href="/files" description="Browse and download files and documents shared by the museum team." />
          <DashCard title="My Profile" icon="👤" href="/profile" description="Update your name, contact details, and general activity preferences." />
          <DashCard title="My Teams" icon="👥" href="/teams" description="View your team memberships, submit work logs or feedback." />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming events preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Upcoming Events</h2>
              <Link href="/schedule" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                View calendar →
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming events in the next 30 days.</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/schedule?month=${fmtMonth(ev.date.getUTCFullYear(), ev.date.getUTCMonth())}&day=${dateToParam(ev.date)}`}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${EVENT_TYPE_BG[ev.eventType as keyof typeof EVENT_TYPE_BG]}`}>
                          {EVENT_TYPE_LABELS[ev.eventType as keyof typeof EVENT_TYPE_LABELS]}
                        </span>
                        {mySignupSet.has(ev.id) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">✓ Signed up</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-900 truncate">{ev.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {ev.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                        {ev.startTime && ` · ${ev.startTime}`}
                        {ev.job && ` · ${ev.job.title}`}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Announcements */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Announcements</h2>
              <Link href="/announcements" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                View all →
              </Link>
            </div>
            {announcements.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent announcements.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann) => (
                  <div key={ann.id} className="flex items-start gap-2">
                    {ann.pinned && <span className="text-amber-500 text-xs mt-0.5">📌</span>}
                    <div>
                      <Link href="/announcements" className="text-sm font-medium text-gray-900 hover:text-blue-600">
                        {ann.title}
                      </Link>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {ann.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My teams */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">My Teams</h2>
              <Link href="/teams" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                View all →
              </Link>
            </div>
            {myTeams.length === 0 ? (
              <p className="text-gray-500 text-sm">You are not currently a member of any team.</p>
            ) : (
              <div className="space-y-3">
                {myTeams.map(({ team }) => {
                  const urgentCount = team.tasks.filter((t) => t.urgency === 'URGENT').length;
                  const activeCount = team.tasks.length;
                  return (
                    <div key={team.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{team.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {urgentCount > 0 && (
                            <span className="text-xs font-medium text-red-700">
                              ⚠️ {urgentCount} urgent task{urgentCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {activeCount > 0 && urgentCount === 0 && (
                            <span className="text-xs text-gray-400">{activeCount} active task{activeCount !== 1 ? 's' : ''}</span>
                          )}
                          {activeCount === 0 && (
                            <span className="text-xs text-gray-400">No active tasks</span>
                          )}
                          {team.userTeams.length > 0 && (
                            <span className="text-xs text-gray-400">· Admin: {team.userTeams.map((m) => m.user.name ?? m.user.email).join(', ')}</span>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/teams/${team.id}`}
                        className="shrink-0 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-colors"
                      >
                        Open →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function DashCard({
  title,
  icon,
  href,
  description,
}: {
  title: string;
  icon: string;
  href: string;
  description: string;
}) {
  return (
    <Link href={href} className="block bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="text-3xl mb-3">{icon}</div>
      <h2 className="font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-gray-500 text-sm">{description}</p>
    </Link>
  );
}
