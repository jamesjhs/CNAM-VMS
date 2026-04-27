import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb, unpackTs } from '@/lib/db';
import Link from 'next/link';
import { deleteFileAsset } from './actions';

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

export default async function FilesAdminPage() {
  await requireCapability('admin:files.read');

  const db = getDb();
  const rawFiles = db.prepare(`
    SELECT fa.id, fa.filename, fa.originalName, fa.mimeType, fa.size, fa.createdAt,
           u.email as uploader_email, u.name as uploader_name
    FROM file_assets fa
    LEFT JOIN users u ON fa.uploadedBy = u.id
    ORDER BY fa.createdAt DESC
  `).all() as {
    id: string; filename: string; originalName: string; mimeType: string; size: number;
    createdAt: string; uploader_email: string | null; uploader_name: string | null;
  }[];

  const files = rawFiles.map((f) => ({
    ...f,
    createdAt: unpackTs(f.createdAt),
    uploader: f.uploader_email ? { email: f.uploader_email, name: f.uploader_name } : null,
  }));

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">File Assets</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">File Assets</h1>
            <p className="text-gray-500">Manage all uploaded files and documents.</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">{files.length} file{files.length !== 1 ? 's' : ''}</div>
            <div className="text-xs text-gray-400">{formatBytes(totalSize)} total</div>
          </div>
        </div>

        <div className="mb-6 flex justify-end">
          <Link
            href="/upload"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Upload File
          </Link>
        </div>

        {files.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-3xl mb-3">📁</p>
            <p className="text-gray-500 mb-4">No files uploaded yet.</p>
            <Link
              href="/upload"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Upload a File
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">File</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Type</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Size</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Uploaded by</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                    <th className="text-right py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{MIME_ICONS[file.mimeType] ?? '📎'}</span>
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{file.originalName}</div>
                            <div className="text-gray-400 text-xs font-mono">{file.filename}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{file.mimeType}</td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{formatBytes(file.size)}</td>
                      <td className="py-3 px-4">
                        {file.uploader ? (
                          <div className="text-xs">
                            <div className="text-gray-900">{file.uploader.name ?? <span className="text-gray-400 italic">No name</span>}</div>
                            <div className="text-gray-500">{file.uploader.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Unknown</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-xs">
                        {file.createdAt.toLocaleString('en-GB')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <a
                            href={`/api/files/${file.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            Download
                          </a>
                          <form action={deleteFileAsset.bind(null, file.id)}>
                            <button
                              type="submit"
                              className="text-red-600 hover:text-red-800 font-medium text-sm"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
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
