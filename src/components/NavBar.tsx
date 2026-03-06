import Link from 'next/link';
import { auth, signOut } from '@/auth';

export default async function NavBar() {
  const session = await auth();

  const capabilities: string[] = (session?.user as { capabilities?: string[] })?.capabilities ?? [];
  const isAdmin =
    capabilities.includes('admin:users.read') ||
    capabilities.includes('admin:roles.read') ||
    capabilities.includes('admin:audit.read') ||
    capabilities.includes('admin:announcements.write') ||
    capabilities.includes('admin:calendar.write');

  return (
    <nav className="bg-[#1a3a5c] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-bold text-lg tracking-tight text-white hover:text-amber-300 transition-colors">
              CNAM VMS
            </Link>
            {session && (
              <>
                <Link href="/dashboard" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Dashboard
                </Link>
                <Link href="/schedule" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Schedule
                </Link>
                <Link href="/announcements" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Announcements
                </Link>
                <Link href="/volunteer/availability" className="text-gray-300 hover:text-white text-sm transition-colors">
                  My Availability
                </Link>
                {isAdmin && (
                  <div className="relative group">
                    <button className="text-gray-300 hover:text-white text-sm transition-colors flex items-center gap-1 py-5">
                      Admin
                      <svg className="w-3 h-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="absolute left-0 top-full hidden group-hover:block bg-white rounded-lg shadow-lg border border-gray-100 min-w-44 py-1 z-50">
                      <Link href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Overview
                      </Link>
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
                    </div>
                  </div>
                )}
                <Link href="/upload" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Upload
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-4">
                <Link href="/profile" className="text-sm text-gray-300 hover:text-white transition-colors">
                  {session.user?.name ?? session.user?.email}
                </Link>
                <form
                  action={async () => {
                    'use server';
                    await signOut({ redirectTo: '/' });
                  }}
                >
                  <button
                    type="submit"
                    className="text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </div>
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
    </nav>
  );
}
