import Link from 'next/link';
import { auth } from '@/auth';
import { signOutAction } from '@/lib/signout-action';
import MobileMenu, { type NavLink } from './MobileMenu';
import VersionDisplay from './VersionDisplay';
import { getDb } from '@/lib/db';

export default async function NavBar() {
  const session = await auth();

  const capabilities: string[] = (session?.user as { capabilities?: string[] })?.capabilities ?? [];
  const isAdmin =
    capabilities.includes('admin:users.read') ||
    capabilities.includes('admin:roles.read') ||
    capabilities.includes('admin:audit.read') ||
    capabilities.includes('admin:announcements.write') ||
    capabilities.includes('admin:calendar.write') ||
    capabilities.includes('admin:theme.write') ||
    capabilities.includes('admin:training.write') ||
    capabilities.includes('admin:tasks.write');

  const isStaff =
    capabilities.includes('staff:volunteer.read') ||
    capabilities.includes('staff:projects.read') ||
    capabilities.includes('staff:messaging.write') ||
    capabilities.includes('staff:schedule.read');

  const showAdminMenu = isAdmin || isStaff;

  // Count how many teams the current user is a member of (for nav badge)
  const userId = (session?.user as { id?: string } | undefined)?.id;
  let myTeamCount = 0;
  if (userId) {
    try {
      const db = getDb();
      const countRow = db.prepare('SELECT COUNT(*) as cnt FROM user_teams WHERE userId = ?').get(userId) as { cnt: number } | undefined;
      myTeamCount = countRow?.cnt ?? 0;
    } catch {
      // Non-critical — leave count as 0 if DB is unavailable
    }
  }
  const teamsLabel = myTeamCount > 0 ? `Teams (${myTeamCount})` : 'Teams';

  // Build nav link lists to pass to the mobile menu client component
  const mainLinks: NavLink[] = session
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/schedule', label: 'Schedule & Availability' },
        { href: '/announcements', label: 'Announcements' },
        { href: '/files', label: 'Files' },
        { href: '/teams', label: teamsLabel },
        { href: '/messages', label: '💬 Messages' },
        { href: '/projects', label: '📋 Projects' },
        { href: '/help', label: '❓ Help' },
      ]
    : [];

  const adminLinks: NavLink[] = [];
  if (showAdminMenu) {
    if (isAdmin) adminLinks.push({ href: '/admin', label: 'Overview' });
    if (capabilities.includes('admin:users.read')) adminLinks.push({ href: '/admin/users', label: 'Users' });
    if (capabilities.includes('admin:roles.read')) adminLinks.push({ href: '/admin/roles', label: 'Roles' });
    if (capabilities.includes('admin:teams.read')) adminLinks.push({ href: '/admin/teams', label: 'Teams' });
    if (capabilities.includes('admin:audit.read')) adminLinks.push({ href: '/admin/audit', label: 'Audit Log' });
    if (capabilities.includes('admin:files.read')) adminLinks.push({ href: '/admin/files', label: 'Files' });
    if (capabilities.includes('admin:announcements.write')) adminLinks.push({ href: '/admin/announcements', label: 'Announcements' });
    if (capabilities.includes('admin:calendar.write')) adminLinks.push({ href: '/admin/schedule', label: 'Schedule' });
    if (capabilities.includes('admin:calendar.write')) adminLinks.push({ href: '/admin/schedule/availability', label: 'Volunteer Availability' });
    if (capabilities.includes('admin:theme.write')) adminLinks.push({ href: '/admin/content', label: 'Site Content' });
    if (capabilities.includes('admin:tasks.write')) adminLinks.push({ href: '/admin/teams/tasks', label: 'Task Forms' });
    if (capabilities.includes('admin:training.write')) adminLinks.push({ href: '/admin/training', label: 'Training Policies' });
    // Coordination items (staff access)
    if (isStaff) adminLinks.push({ href: '/coordination', label: 'Coordination Overview' });
    if (capabilities.includes('staff:volunteer.read')) adminLinks.push({ href: '/coordination/volunteers', label: 'Volunteers' });
    if (capabilities.includes('staff:schedule.read')) adminLinks.push({ href: '/coordination/availability', label: 'Availability' });
  }

  return (
    <>
      <nav className="bg-[#1a3a5c] text-white shadow-md relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <Link href={session ? '/dashboard' : '/'} className="font-bold text-lg tracking-tight text-white hover:text-amber-300 transition-colors">
                CNAM VMS
              </Link>

              {/* Desktop nav links (hidden on mobile) */}
              {session && (
                <div className="hidden md:flex items-center gap-6">
                <Link href="/dashboard" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Dashboard
                </Link>
                <Link href="/schedule" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Schedule &amp; Availability
                </Link>
                <Link href="/announcements" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Announcements
                </Link>
                <Link href="/files" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Files
                </Link>
                <Link href="/teams" className="text-gray-300 hover:text-white text-sm transition-colors">
                  {teamsLabel}
                </Link>
                <Link href="/messages" className="text-gray-300 hover:text-white text-sm transition-colors">
                  💬 Messages
                </Link>
                <Link href="/projects" className="text-gray-300 hover:text-white text-sm transition-colors">
                  📋 Projects
                </Link>
                <Link href="/help" className="text-gray-300 hover:text-white text-sm transition-colors">
                  ❓ Help
                </Link>
                {showAdminMenu && (
                  <div className="relative group">
                    <button className="text-gray-300 hover:text-white text-sm transition-colors flex items-center gap-1 py-5">
                      Admin
                      <svg className="w-3 h-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="absolute left-0 top-full hidden group-hover:block bg-white rounded-lg shadow-lg border border-gray-100 min-w-52 py-1 z-50">
                      {isAdmin && (
                        <Link href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Overview
                        </Link>
                      )}
                      {capabilities.includes('admin:users.read') && (
                        <Link href="/admin/users" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Users
                        </Link>
                      )}
                      {capabilities.includes('admin:roles.read') && (
                        <Link href="/admin/roles" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Roles
                        </Link>
                      )}
                      {capabilities.includes('admin:teams.read') && (
                        <Link href="/admin/teams" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Teams
                        </Link>
                      )}
                      {capabilities.includes('admin:audit.read') && (
                        <Link href="/admin/audit" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Audit Log
                        </Link>
                      )}
                      {capabilities.includes('admin:files.read') && (
                        <Link href="/admin/files" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Files
                        </Link>
                      )}
                      {capabilities.includes('admin:announcements.write') && (
                        <Link href="/admin/announcements" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Announcements
                        </Link>
                      )}
                      {capabilities.includes('admin:calendar.write') && (
                        <Link href="/admin/schedule" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Schedule
                        </Link>
                      )}
                      {capabilities.includes('admin:calendar.write') && (
                        <Link href="/admin/schedule/availability" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Volunteer Availability
                        </Link>
                      )}
                      {capabilities.includes('admin:theme.write') && (
                        <Link href="/admin/content" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Site Content
                        </Link>
                      )}
                      {capabilities.includes('admin:tasks.write') && (
                        <Link href="/admin/teams/tasks" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Task Forms
                        </Link>
                      )}
                      {capabilities.includes('admin:training.write') && (
                        <Link href="/admin/training" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Training Policies
                        </Link>
                      )}
                      {/* Coordination items for staff */}
                      {isStaff && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <Link href="/coordination" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            Coordination Overview
                          </Link>
                          {capabilities.includes('staff:volunteer.read') && (
                            <Link href="/coordination/volunteers" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              Volunteers
                            </Link>
                          )}
                          {capabilities.includes('staff:schedule.read') && (
                            <Link href="/coordination/availability" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              Availability
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side: desktop user controls + mobile hamburger */}
          <div className="flex items-center gap-3">
            {session ? (
              <>
                {/* Desktop: profile link + sign out */}
                <div className="hidden md:flex items-center gap-4">
                  <Link href="/profile" className="text-sm text-gray-300 hover:text-white transition-colors">
                    {session.user?.name ?? session.user?.email}
                  </Link>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-colors"
                    >
                      Sign out
                    </button>
                  </form>
                </div>

                {/* Mobile sign-out button (always visible alongside hamburger) */}
                <form className="md:hidden" action={signOutAction}>
                  <button
                    type="submit"
                    className="text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded transition-colors"
                  >
                    Sign out
                  </button>
                </form>

                {/* Mobile hamburger menu */}
                <MobileMenu
                  links={mainLinks}
                  adminLinks={adminLinks}
                  showAdminMenu={showAdminMenu}
                  userName={session.user?.name}
                  userEmail={session.user?.email}
                />
              </>
            ) : (
              <Link
                href="/auth/signin"
                className="text-sm bg-amber-500 hover:bg-amber-400 text-white px-4 py-1.5 rounded font-medium transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
      <VersionDisplay />
    </nav>
    </>
  );
}
