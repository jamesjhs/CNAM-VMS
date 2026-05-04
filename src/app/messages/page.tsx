import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { getDb, unpackBool, unpackTs } from '@/lib/db';
import { sendDirectMessage } from './actions';

export default async function MessagesPage() {
  const currentUser = await requireAuth();
  const db = getDb();

  // All active users except self for compose dropdown
  const allUsers = db.prepare(`
    SELECT id, name, email FROM users
    WHERE id != ? AND status = 'ACTIVE'
    ORDER BY name ASC, email ASC
  `).all(currentUser.id) as { id: string; name: string | null; email: string }[];

  // All conversations: distinct partner IDs from messages involving this user
  const rawConvPartners = db.prepare(`
    SELECT DISTINCT
      CASE WHEN senderId = ? THEN recipientId ELSE senderId END AS partnerId
    FROM messages
    WHERE teamId IS NULL
      AND (senderId = ? OR recipientId = ?)
      AND (senderId IS NOT NULL AND recipientId IS NOT NULL)
  `).all(currentUser.id, currentUser.id, currentUser.id) as { partnerId: string }[];

  type ConversationRow = {
    partnerId: string;
    partnerName: string | null;
    partnerEmail: string;
    lastBody: string;
    lastIsDeleted: number;
    lastCreatedAt: string;
    unreadCount: number;
  };

  const conversations: ConversationRow[] = [];

  for (const { partnerId } of rawConvPartners) {
    const partner = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(partnerId) as {
      id: string; name: string | null; email: string;
    } | undefined;

    if (!partner) continue;

    const lastMsg = db.prepare(`
      SELECT body, isDeleted, createdAt
      FROM messages
      WHERE teamId IS NULL
        AND ((senderId = ? AND recipientId = ?) OR (senderId = ? AND recipientId = ?))
      ORDER BY createdAt DESC
      LIMIT 1
    `).get(currentUser.id, partnerId, partnerId, currentUser.id) as {
      body: string; isDeleted: number; createdAt: string;
    } | undefined;

    if (!lastMsg) continue;

    const lastReadRow = db.prepare(`
      SELECT lastReadAt FROM message_reads WHERE userId = ? AND context = ?
    `).get(currentUser.id, `direct:${partnerId}`) as { lastReadAt: string } | undefined;

    const lastReadAt = lastReadRow?.lastReadAt ?? '1970-01-01T00:00:00.000Z';

    const { unreadCount } = db.prepare(`
      SELECT COUNT(*) as unreadCount
      FROM messages
      WHERE teamId IS NULL
        AND senderId = ?
        AND recipientId = ?
        AND isDeleted = 0
        AND createdAt > ?
    `).get(partnerId, currentUser.id, lastReadAt) as { unreadCount: number };

    conversations.push({
      partnerId,
      partnerName: partner.name,
      partnerEmail: partner.email,
      lastBody: lastMsg.body,
      lastIsDeleted: lastMsg.isDeleted,
      lastCreatedAt: lastMsg.createdAt,
      unreadCount,
    });
  }

  // Sort by most recent message first
  conversations.sort((a, b) => b.lastCreatedAt.localeCompare(a.lastCreatedAt));

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Messages</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 mb-8">Messages</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Compose panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Compose New Message</h2>
              <form
                action={async (fd: FormData) => {
                  'use server';
                  const recipientId = fd.get('recipientId') as string;
                  const body = fd.get('body') as string;
                  await sendDirectMessage(recipientId, body);
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="recipientId" className="block text-sm font-medium text-gray-700 mb-1">
                    To
                  </label>
                  <select
                    id="recipientId"
                    name="recipientId"
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a recipient…</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
                    Message
                  </label>
                  <textarea
                    id="body"
                    name="body"
                    required
                    maxLength={2000}
                    rows={4}
                    placeholder="Type your message…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>

          {/* Conversations list */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
              </div>

              {conversations.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-500 text-sm">No conversations yet. Send a message to get started.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {conversations.map((conv) => {
                    const preview = unpackBool(conv.lastIsDeleted)
                      ? '{message deleted}'
                      : conv.lastBody.length > 80
                        ? conv.lastBody.slice(0, 80) + '…'
                        : conv.lastBody;
                    const lastTime = unpackTs(conv.lastCreatedAt).toLocaleString('en-GB', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    });
                    return (
                      <li key={conv.partnerId}>
                        <Link
                          href={`/messages/${conv.partnerId}`}
                          className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {conv.partnerName ?? conv.partnerEmail}
                              </span>
                              {conv.unreadCount > 0 && (
                                <span
                                  aria-label={`${conv.unreadCount} unread message${conv.unreadCount !== 1 ? 's' : ''}`}
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0"
                                >
                                  {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                </span>
                              )}
                            </div>
                            <p className={`text-xs truncate ${unpackBool(conv.lastIsDeleted) ? 'text-gray-400 italic' : 'text-gray-500'}`}>
                              {preview}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{lastTime}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
