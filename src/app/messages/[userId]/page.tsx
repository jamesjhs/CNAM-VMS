import { requireAuth, hasCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { getDb, unpackBool, unpackTs, now } from '@/lib/db';
import { notFound } from 'next/navigation';
import { sendDirectMessage, deleteMessage, reportMessage } from '../actions';

export default async function DirectMessageThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: otherUserId } = await params;
  const currentUser = await requireAuth();
  const db = getDb();

  const otherUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(otherUserId) as {
    id: string; name: string | null; email: string;
  } | undefined;

  if (!otherUser) notFound();

  // Mark thread as read immediately
  const ts = now();
  db.prepare(
    `INSERT OR REPLACE INTO message_reads (userId, context, lastReadAt) VALUES (?, ?, ?)`,
  ).run(currentUser.id, `direct:${otherUserId}`, ts);

  const rawMessages = db.prepare(`
    SELECT m.id, m.body, m.senderId, m.isDeleted, m.deletedAt, m.createdAt,
           u.name as senderName, u.email as senderEmail
    FROM messages m
    LEFT JOIN users u ON m.senderId = u.id
    WHERE m.teamId IS NULL
      AND ((m.senderId = ? AND m.recipientId = ?) OR (m.senderId = ? AND m.recipientId = ?))
    ORDER BY m.createdAt ASC
  `).all(currentUser.id, otherUserId, otherUserId, currentUser.id) as {
    id: string;
    body: string;
    senderId: string | null;
    isDeleted: number;
    deletedAt: string | null;
    createdAt: string;
    senderName: string | null;
    senderEmail: string | null;
  }[];

  // Which messages have been reported by the current user?
  const reportedIds = new Set(
    (db.prepare(
      `SELECT messageId FROM message_reports WHERE reportedById = ?`,
    ).all(currentUser.id) as { messageId: string }[]).map((r) => r.messageId),
  );

  const canAdmin = hasCapability(currentUser, 'admin:users.write');
  const isRoot = hasCapability(currentUser, 'admin:settings.write');

  const messages = rawMessages.map((m) => ({
    ...m,
    isDeleted: unpackBool(m.isDeleted),
    createdAt: unpackTs(m.createdAt),
    isMine: m.senderId === currentUser.id,
    alreadyReported: reportedIds.has(m.id),
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
          <span>/</span>
          <Link href="/messages" className="hover:text-gray-700">Messages</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{otherUser.name ?? otherUser.email}</span>
        </nav>

        <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h1 className="text-lg font-semibold text-gray-900">
              {otherUser.name ?? otherUser.email}
            </h1>
            {otherUser.name && (
              <p className="text-xs text-gray-400">{otherUser.email}</p>
            )}
          </div>

          {/* Message list */}
          <div className="flex-1 px-6 py-4 space-y-4 min-h-[300px]">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No messages yet. Say hello!</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] ${msg.isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className={`text-xs text-gray-400 ${msg.isMine ? 'text-right' : 'text-left'}`}>
                      {msg.isMine ? 'You' : (msg.senderName ?? msg.senderEmail ?? 'Unknown')}
                      {' · '}
                      {msg.createdAt.toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm ${
                        msg.isMine
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      {msg.isDeleted ? (
                        isRoot ? (
                          <span>
                            <span className="line-through opacity-60">{msg.body}</span>{' '}
                            <span className="text-xs opacity-75">(deleted)</span>
                          </span>
                        ) : (
                          <span className="italic opacity-70">{'{message deleted}'}</span>
                        )
                      ) : (
                        <span className="whitespace-pre-wrap break-words">{msg.body}</span>
                      )}
                    </div>

                    {/* Action buttons */}
                    {!msg.isDeleted && (
                      <div className={`flex gap-2 ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                        {/* Report button */}
                        <form action={reportMessage.bind(null, msg.id)}>
                          <button
                            type="submit"
                            title={msg.alreadyReported ? 'Already reported' : 'Report message'}
                            className={`text-xs px-2 py-0.5 rounded transition-colors ${
                              msg.alreadyReported
                                ? 'text-amber-500 cursor-default'
                                : 'text-gray-400 hover:text-amber-500'
                            }`}
                          >
                            ⚠
                          </button>
                        </form>

                        {/* Delete button */}
                        {(msg.isMine || canAdmin) && (
                          <form action={deleteMessage.bind(null, msg.id)}>
                            <button
                              type="submit"
                              title="Delete message"
                              className="text-xs px-2 py-0.5 rounded text-gray-400 hover:text-red-500 transition-colors"
                            >
                              🗑
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Compose form */}
          <div className="px-6 py-4 border-t border-gray-100">
            <form
              action={async (fd: FormData) => {
                'use server';
                const body = fd.get('body') as string;
                await sendDirectMessage(otherUserId, body);
              }}
              className="flex gap-3"
            >
              <textarea
                name="body"
                required
                maxLength={2000}
                rows={2}
                placeholder="Write a message…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors self-end"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
