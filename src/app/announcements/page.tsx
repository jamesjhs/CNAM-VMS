import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';

export default async function AnnouncementsPage() {
  await requireAuth();

  const announcements = await prisma.announcement.findMany({
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    include: { author: { select: { name: true, email: true } } },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Announcements</h1>
          <p className="text-gray-500">Latest news and updates from the museum.</p>
        </div>

        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-3xl mb-3">📣</p>
            <p className="text-gray-500">No announcements yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((ann) => (
              <article
                key={ann.id}
                className={`bg-white rounded-xl border p-6 ${ann.pinned ? 'border-amber-300' : 'border-gray-200'}`}
              >
                <div className="flex items-start gap-3 mb-2">
                  {ann.pinned && (
                    <span className="mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                      📌 Pinned
                    </span>
                  )}
                  <h2 className="text-lg font-semibold text-gray-900">{ann.title}</h2>
                </div>
                <p className="text-gray-700 text-sm whitespace-pre-wrap mb-4">{ann.body}</p>
                <div className="text-xs text-gray-400">
                  {ann.createdAt.toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {ann.author && ` — ${ann.author.name ?? ann.author.email}`}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
