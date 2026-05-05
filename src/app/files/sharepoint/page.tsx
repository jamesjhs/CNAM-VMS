import { requireAuth, hasCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb } from '@/lib/db';
import Link from 'next/link';
import { getSharePointConfig, listFolder, isSharePointConfigured } from '@/lib/sharepoint';
import type { SharePointItem } from '@/lib/sharepoint';
import SharePointUploadForm from './SharePointUploadForm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
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

function getIcon(item: SharePointItem): string {
  if (item.folder) return '📁';
  if (item.file?.mimeType) return MIME_ICONS[item.file.mimeType] ?? '📎';
  return '📎';
}

/** Build a breadcrumb array from a path string like "Training/Subdir" */
function buildBreadcrumbs(path: string): { label: string; href: string }[] {
  const crumbs: { label: string; href: string }[] = [
    { label: 'SharePoint Files', href: '/files/sharepoint' },
  ];
  if (!path) return crumbs;
  const parts = path.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    crumbs.push({
      label: parts[i],
      href: `/files/sharepoint?path=${encodeURIComponent(parts.slice(0, i + 1).join('/'))}`,
    });
  }
  return crumbs;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SharePointFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const user = await requireAuth();

  if (!isSharePointConfigured()) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">SharePoint Files</h1>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-3xl mb-3">☁️</p>
            <p className="text-gray-700 font-medium mb-2">SharePoint is not configured</p>
            <p className="text-gray-500 text-sm">
              An administrator needs to configure the SharePoint integration before files can be
              accessed.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const canRead  = hasCapability(user, 'files:sharepoint.read');
  const canWrite = hasCapability(user, 'files:sharepoint.write');
  const isAdmin  = hasCapability(user, 'admin:teams.read');

  if (!canRead) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-3xl mb-3">🔒</p>
            <p className="text-gray-700 font-medium">
              You do not have permission to view SharePoint files.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const { path: rawPath } = await searchParams;
  const currentPath = (rawPath ?? '').replace(/\.\.+/g, '').replace(/^\//, '').trim();
  const breadcrumbs = buildBreadcrumbs(currentPath);

  const config = getSharePointConfig()!;

  // ─── Fetch folder contents ──────────────────────────────────────────────────
  let items: SharePointItem[] = [];
  let fetchError: string | null = null;

  try {
    if (!currentPath) {
      // Root view: show fixed top-level sections as virtual cards
      items = [];
    } else {
      items = await listFolder(config, currentPath);
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load files from SharePoint.';
  }

  // ─── Teams section — load DB teams for the current user ────────────────────
  type TeamRow = { id: string; name: string; sharepoint_folder_path: string | null };
  const db = getDb();
  let teamsWithFolders: TeamRow[] = [];
  if (!currentPath) {
    const allTeams = db.prepare('SELECT id, name, sharepoint_folder_path FROM teams ORDER BY name ASC').all() as TeamRow[];
    if (isAdmin) {
      teamsWithFolders = allTeams;
    } else {
      const myTeamIds = (
        db.prepare('SELECT teamId FROM user_teams WHERE userId = ?').all(user.id) as { teamId: string }[]
      ).map((r) => r.teamId);
      teamsWithFolders = allTeams.filter((t) => myTeamIds.includes(t.id));
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/files" className="hover:text-gray-700">Files</Link>
          <span>/</span>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-2">
              {i === breadcrumbs.length - 1 ? (
                <span className="text-gray-900 font-medium">{crumb.label}</span>
              ) : (
                <>
                  <Link href={crumb.href} className="hover:text-gray-700">{crumb.label}</Link>
                  <span>/</span>
                </>
              )}
            </span>
          ))}
        </nav>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {currentPath ? currentPath.split('/').pop() : 'SharePoint Files'}
            </h1>
            <p className="text-gray-500 text-sm">
              {currentPath
                ? `Browsing: ${currentPath}`
                : 'Select a section to browse files stored in SharePoint.'}
            </p>
          </div>
        </div>

        {fetchError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <strong>Error loading files:</strong> {fetchError}
          </div>
        )}

        {/* ─── Root view: section cards ─── */}
        {!currentPath && (
          <div className="space-y-6">
            {/* Fixed sections */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <SectionCard href="/files/sharepoint?path=Training" icon="📚" label="Training" description="Training documents and materials." />
              <SectionCard href="/files/sharepoint?path=Policies" icon="📋" label="Policies" description="Museum policies and procedures." />
              <SectionCard href="/files/sharepoint?path=Teams"    icon="👥" label="Teams"    description="Your team workspaces and files." />
            </div>

            {/* Teams quick-access (for users with team memberships) */}
            {teamsWithFolders.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">My Team Folders</h2>
                <div className="divide-y divide-gray-100">
                  {teamsWithFolders.map((team) =>
                    team.sharepoint_folder_path ? (
                      <Link
                        key={team.id}
                        href={`/files/sharepoint?path=${encodeURIComponent(team.sharepoint_folder_path)}`}
                        className="flex items-center gap-3 py-3 hover:bg-gray-50 px-2 rounded transition-colors"
                      >
                        <span className="text-lg">📁</span>
                        <span className="font-medium text-gray-900 text-sm">{team.name}</span>
                        <span className="ml-auto text-gray-400 text-xs">{team.sharepoint_folder_path}</span>
                      </Link>
                    ) : (
                      <div
                        key={team.id}
                        className="flex items-center gap-3 py-3 px-2 opacity-50"
                        title="No SharePoint folder configured for this team"
                      >
                        <span className="text-lg">📁</span>
                        <span className="font-medium text-gray-700 text-sm">{team.name}</span>
                        <span className="ml-auto text-gray-400 text-xs italic">no folder</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Folder contents ─── */}
        {currentPath && !fetchError && (
          <div className="space-y-6">
            {/* Upload form for users with write access */}
            {canWrite && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Upload to this folder</h2>
                <SharePointUploadForm folderPath={currentPath} />
              </div>
            )}

            {/* File listing */}
            {items.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-3xl mb-3">📂</p>
                <p className="text-gray-500">This folder is empty.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium hidden sm:table-cell">
                          Size
                        </th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium hidden md:table-cell">
                          Modified
                        </th>
                        <th className="text-right py-3 px-4 text-gray-500 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg shrink-0">{getIcon(item)}</span>
                              {item.folder ? (
                                <Link
                                  href={`/files/sharepoint?path=${encodeURIComponent(
                                    currentPath ? `${currentPath}/${item.name}` : item.name,
                                  )}`}
                                  className="font-medium text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  {item.name}
                                </Link>
                              ) : (
                                <span className="font-medium text-gray-900 text-sm">
                                  {item.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap hidden sm:table-cell">
                            {item.size !== undefined ? formatBytes(item.size) : item.folder ? '—' : '—'}
                          </td>
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-xs hidden md:table-cell">
                            {item.lastModifiedDateTime
                              ? new Date(item.lastModifiedDateTime).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.folder ? (
                              <Link
                                href={`/files/sharepoint?path=${encodeURIComponent(
                                  currentPath ? `${currentPath}/${item.name}` : item.name,
                                )}`}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                Open
                              </Link>
                            ) : (
                              <a
                                href={`/api/sharepoint/download?itemId=${encodeURIComponent(item.id)}`}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                Download
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SectionCard({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow block"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-1">{label}</h3>
      <p className="text-gray-500 text-sm">{description}</p>
    </Link>
  );
}
