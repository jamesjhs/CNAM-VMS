import Link from 'next/link';
import NavBar from '@/components/NavBar';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 mb-6">
            You don&apos;t have permission to access this page.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/dashboard"
              className="bg-[#1a3a5c] hover:bg-[#2d5986] text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
