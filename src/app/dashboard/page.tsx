import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  const user = await requireAuth();

  // Fetch a preview of recent pinned/latest announcements
  const announcements = await prisma.announcement.findMany({
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 3,
    select: { id: true, title: true, pinned: true, createdAt: true },
  });

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
          <DashCard title="My Tasks" icon="📋" href="#" description="View and manage your assigned tasks." comingSoon />
          <DashCard title="Schedule" icon="📅" href="#" description="Check your upcoming shifts and availability." comingSoon />
          <DashCard title="Announcements" icon="📣" href="/announcements" description="Latest news and updates from the museum." />
          <DashCard title="My Availability" icon="🗓️" href="/volunteer/availability" description="Set the activities you are available to help with." />
          <DashCard title="My Profile" icon="👤" href="/profile" description="Update your name and contact details." />
        </div>

        {/* Recent announcements preview */}
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
      </main>
    </div>
  );
}

function DashCard({
  title,
  icon,
  href,
  description,
  comingSoon,
}: {
  title: string;
  icon: string;
  href: string;
  description: string;
  comingSoon?: boolean;
}) {
  const inner = (
    <div className={`bg-white rounded-xl border p-6 h-full transition-shadow ${comingSoon ? 'border-gray-100 opacity-60' : 'border-gray-200 hover:shadow-md'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-3xl">{icon}</div>
        {comingSoon && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Coming soon</span>
        )}
      </div>
      <h2 className="font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-gray-500 text-sm">{description}</p>
    </div>
  );

  if (comingSoon) return <div>{inner}</div>;
  return <Link href={href} className="block">{inner}</Link>;
}

