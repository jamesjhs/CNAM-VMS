import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; user?: string }>;
}) {
  await requireCapability('admin:audit.read');

  const { page: pageParam, action: actionFilter, user: userFilter } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));

  const where = {
    ...(actionFilter ? { action: { contains: actionFilter, mode: 'insensitive' as const } } : {}),
    ...(userFilter
      ? {
          user: {
            OR: [
              { email: { contains: userFilter, mode: 'insensitive' as const } },
              { name: { contains: userFilter, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { email: true, name: true } } },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(params: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    if (params.page && params.page !== '1') q.set('page', params.page);
    if (params.action) q.set('action', params.action);
    if (params.user) q.set('user', params.user);
    const qs = q.toString();
    return `/admin/audit${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Audit Log</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Audit Log</h1>
            <p className="text-gray-500">Full record of all actions taken in the system.</p>
          </div>
          <span className="text-sm text-gray-500">{total.toLocaleString()} event{total !== 1 ? 's' : ''}</span>
        </div>

        {/* Filters */}
        <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <input
            name="action"
            type="text"
            defaultValue={actionFilter ?? ''}
            placeholder="Filter by action (e.g. USER_CREATED)"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            name="user"
            type="text"
            defaultValue={userFilter ?? ''}
            placeholder="Filter by user email or name"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            Search
          </button>
          {(actionFilter || userFilter) && (
            <Link
              href="/admin/audit"
              className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap text-center"
            >
              Clear
            </Link>
          )}
        </form>

        {/* Table */}
        {logs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500">No audit events found{actionFilter || userFilter ? ' matching your filters' : ''}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium whitespace-nowrap">When</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">User</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Action</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Resource</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                        {log.createdAt.toLocaleString('en-GB')}
                      </td>
                      <td className="py-3 px-4">
                        {log.user ? (
                          <div>
                            <div className="font-medium text-gray-900 text-xs">{log.user.name ?? <span className="text-gray-400 italic">No name</span>}</div>
                            <div className="text-gray-500 text-xs">{log.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">system</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {log.resource ? (
                          <span>{log.resource}{log.resourceId ? <span className="text-gray-400"> #{log.resourceId.slice(0, 8)}</span> : null}</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs max-w-xs">
                        {log.detail ? (
                          <span className="font-mono text-gray-400 text-xs truncate block">
                            {JSON.stringify(log.detail)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} &mdash; {total.toLocaleString()} events total
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1), action: actionFilter, user: userFilter })}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1), action: actionFilter, user: userFilter })}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
