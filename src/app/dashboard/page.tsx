import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import Link from 'next/link';

export default async function DashboardPage() {
  const user = await requireAuth();

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <DashCard title="My Tasks" icon="📋" href="#" description="View and manage your assigned tasks." />
          <DashCard title="Schedule" icon="📅" href="#" description="Check your upcoming shifts and availability." />
          <DashCard title="Announcements" icon="📣" href="#" description="Latest news and updates from the museum." />
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
    <Link
      href={href}
      className="block bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h2 className="font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-gray-500 text-sm">{description}</p>
    </Link>
  );
}
