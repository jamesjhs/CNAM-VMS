import Link from 'next/link';
import { auth, signOut } from '@/auth';

export default async function NavBar() {
  const session = await auth();

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
                <Link href="/admin" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Admin
                </Link>
                <Link href="/upload" className="text-gray-300 hover:text-white text-sm transition-colors">
                  Upload
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-300">{session.user?.email}</span>
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
