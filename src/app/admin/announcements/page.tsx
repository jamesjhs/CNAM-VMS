import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackTs, unpackBool } from '@/lib/db';
import Link from 'next/link';
import { createAnnouncement, deleteAnnouncement, toggleAnnouncementPin } from './actions';

export default async function AnnouncementsAdminPage() {
  await requireCapability('admin:announcements.write');

  const db = getDb();
  const rawAnnouncements = db.prepare(`
    SELECT a.id, a.title, a.body, a.pinned, a.createdAt,
           u.email as author_email, u.name as author_name
    FROM announcements a
    LEFT JOIN users u ON a.authorId = u.id
    ORDER BY a.pinned DESC, a.createdAt DESC
  `).all() as {
    id: string; title: string; body: string; pinned: number; createdAt: string;
    author_email: string | null; author_name: string | null;
  }[];

  const announcements = rawAnnouncements.map((a) => ({
    ...a,
    pinned: unpackBool(a.pinned),
    createdAt: unpackTs(a.createdAt),
    author: a.author_email ? { email: a.author_email, name: a.author_name } : null,
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Announcements</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Announcements</h1>
            <p className="text-gray-500">Create and manage announcements for volunteers.</p>
          </div>
          <span className="text-sm text-gray-500">{announcements.length} announcement{announcements.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Create form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">New Announcement</h2>
          <form
            action={async (formData: FormData) => {
              'use server';
              const title = formData.get('title') as string;
              const body = formData.get('body') as string;
              const pinned = formData.get('pinned') === 'on';
              await createAnnouncement(title, body, pinned);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
              <input
                name="title"
                type="text"
                maxLength={200}
                required
                placeholder="Announcement title"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Body</label>
              <textarea
                name="body"
                maxLength={5000}
                required
                rows={4}
                placeholder="Write the announcement here..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="pinned"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Pin to top
              </label>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Publish
              </button>
            </div>
          </form>
        </div>

        {/* Announcements list */}
        {announcements.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No announcements yet. Create your first announcement above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className={`bg-white rounded-xl border p-6 ${ann.pinned ? 'border-amber-300' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {ann.pinned && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          📌 Pinned
                        </span>
                      )}
                      <h3 className="font-semibold text-gray-900">{ann.title}</h3>
                    </div>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap mb-3">{ann.body}</p>
                    <div className="text-xs text-gray-400">
                      Posted {ann.createdAt.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {ann.author && ` by ${ann.author.name ?? ann.author.email}`}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <form action={toggleAnnouncementPin.bind(null, ann.id, !ann.pinned)}>
                      <button
                        type="submit"
                        className="w-full text-xs text-gray-600 hover:text-gray-900 font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap"
                      >
                        {ann.pinned ? 'Unpin' : 'Pin'}
                      </button>
                    </form>
                    <form action={deleteAnnouncement.bind(null, ann.id)}>
                      <button
                        type="submit"
                        className="w-full text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors whitespace-nowrap"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
