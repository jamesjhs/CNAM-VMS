import { requireAuth } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackTs } from '@/lib/db';
import Link from 'next/link';
import { isSharePointConfigured } from '@/lib/sharepoint';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MIME_ICONS: Record<string, string> = {
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/gif': '🖼️',
  'image/webp': '🖼️',
  'application/pdf': '📄',
  'text/plain': '📝',
  'text/csv': '📊',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
};

export default async function FilesPage() {
  await requireAuth();

  const spConfigured = isSharePointConfigured();

  const db = getDb();
  const rawFiles = db.prepare(
    'SELECT id, originalName, mimeType, size, createdAt FROM file_assets ORDER BY createdAt DESC',
  ).all() as { id: string; originalName: string; mimeType: string; size: number; createdAt: string }[];

  const files = rawFiles.map((f) => ({ ...f, createdAt: unpackTs(f.createdAt) }));

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Files &amp; Documents</h1>
            <p className="text-gray-500">
              Browse and download files and documents shared by the museum team.
            </p>
          </div>
          {spConfigured && (
            <Link
              href="/files/sharepoint"
              className="shrink-0 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              ☁️ SharePoint Files
            </Link>
          )}
        </div>

        {files.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-3xl mb-3">📁</p>
            <p className="text-gray-500">No files have been uploaded yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">File</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium hidden sm:table-cell">Type</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium hidden sm:table-cell">Size</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium hidden md:table-cell">Date</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-medium">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 min-w-0 max-w-0 sm:max-w-none">
                        <div className="flex items-center gap-2">
                          <span className="text-lg shrink-0">{MIME_ICONS[file.mimeType] ?? '📎'}</span>
                          <span className="font-medium text-gray-900 text-sm truncate">{file.originalName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs hidden sm:table-cell">{file.mimeType}</td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap hidden sm:table-cell">{formatBytes(file.size)}</td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-xs hidden md:table-cell">
                        {file.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`/api/files/${file.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
