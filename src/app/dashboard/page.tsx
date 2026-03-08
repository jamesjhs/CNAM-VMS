import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { EVENT_TYPE_BG, EVENT_TYPE_LABELS, fmtMonth, dateToParam } from '@/lib/calendar';

export default async function DashboardPage() {
  const user = await requireAuth();

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Fetch upcoming events (next 30 days), user's signups, and team memberships
  const [announcements, upcomingEvents, mySignupIds, myTeams] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 3,
      select: { id: true, title: true, pinned: true, createdAt: true },
    }),
    prisma.calendarEvent.findMany({
      where: {
        date: {
          gte: todayUTC,
          lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30)),
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 5,
      include: {
        job: { select: { title: true, colour: true } },
        _count: { select: { signups: true } },
      },
    }),
    prisma.eventSignup.findMany({
      where: {
        userId: user.id,
        event: {
          date: {
            gte: todayUTC,
            lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30)),
          },
        },
      },
      select: { eventId: true },
    }),
    prisma.userTeam.findMany({
      where: { userId: user.id },
      include: {
        team: {
          include: {
            leader: { select: { id: true, name: true, email: true } },
            tasks: {
              where: { isActive: true },
              select: { id: true, urgency: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    }),
  ]);

  const mySignupSet = new Set(mySignupIds.map((s) => s.eventId));

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
          <DashCard title="Announcements" icon="📣" href="/announcements" description="Latest news and updates from the museum." />
          <DashCard title="Files &amp; Documents" icon="📁" href="/files" description="Browse and download files and documents shared by the museum team." />
          <DashCard title="My Profile" icon="👤" href="/profile" description="Update your name, contact details, and general activity preferences." />
          <DashCard title="My Teams" icon="👥" href="/teams" description="View your team memberships, active tasks, and submit work logs or feedback." />
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
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${EVENT_TYPE_BG[ev.eventType]}`}>
                          {EVENT_TYPE_LABELS[ev.eventType]}
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

          {/* Recent announcements */}
          {announcements.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Recent Announcements</h2>
                <Link href="/announcements" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  View all →
                </Link>
              </div>
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
            </div>
          )}

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
                          {team.leader && (
                            <span className="text-xs text-gray-400">· Leader: {team.leader.name ?? team.leader.email}</span>
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

