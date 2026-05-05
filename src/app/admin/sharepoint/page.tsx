import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb } from '@/lib/db';
import Link from 'next/link';
import { saveSharePointSettings, clearSharePointSettings, testSharePointConnection } from './actions';

export const metadata = {
  title: 'SharePoint Settings — Admin',
};

function getSetting(db: ReturnType<typeof getDb>, key: string): string | null {
  const row = db
    .prepare('SELECT value FROM system_settings WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export default async function AdminSharePointPage({
  searchParams,
}: {
  searchParams: Promise<{ testResult?: string; testMessage?: string }>;
}) {
  await requireCapability('admin:sharepoint.write');

  const { testResult, testMessage } = await searchParams;

  const db = getDb();

  const dbTenantId   = getSetting(db, 'sharepoint.tenantId');
  const dbClientId   = getSetting(db, 'sharepoint.clientId');
  const dbSiteUrl    = getSetting(db, 'sharepoint.siteUrl');
  const dbDriveName  = getSetting(db, 'sharepoint.driveName');
  const hasDbSecret  = getSetting(db, 'sharepoint.clientSecret') !== null;

  // Effective values — DB overrides env, show placeholder if neither set
  const effectiveTenantId  = dbTenantId  ?? process.env.SHAREPOINT_TENANT_ID  ?? '';
  const effectiveClientId  = dbClientId  ?? process.env.SHAREPOINT_CLIENT_ID  ?? '';
  const effectiveSiteUrl   = dbSiteUrl   ?? process.env.SHAREPOINT_SITE_URL   ?? '';
  const effectiveDriveName = dbDriveName ?? process.env.SHAREPOINT_DRIVE_NAME ?? 'Documents';

  const envOnlyTenantId  = !dbTenantId  && !!process.env.SHAREPOINT_TENANT_ID;
  const envOnlyClientId  = !dbClientId  && !!process.env.SHAREPOINT_CLIENT_ID;
  const envOnlySecret    = !hasDbSecret && !!process.env.SHAREPOINT_CLIENT_SECRET;
  const envOnlySiteUrl   = !dbSiteUrl   && !!process.env.SHAREPOINT_SITE_URL;
  const envOnlyDriveName = !dbDriveName && !!process.env.SHAREPOINT_DRIVE_NAME;

  const anyEnvOnly = envOnlyTenantId || envOnlyClientId || envOnlySecret ||
                     envOnlySiteUrl  || envOnlyDriveName;

  const anyDbValues = dbTenantId || dbClientId || dbSiteUrl || dbDriveName || hasDbSecret;

  const isConfigured = !!(effectiveTenantId && effectiveClientId && effectiveSiteUrl);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">SharePoint Settings</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">SharePoint Integration</h1>
          <p className="text-gray-500">
            Connect CNAM VMS to an Azure SharePoint document library using a registered Azure AD
            application. Changes take effect immediately.
          </p>
        </div>

        {/* Connection test result banner */}
        {testResult === 'success' && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
            <strong>✓ Connection successful!</strong> The top-level folders (Training, Policies,
            Teams) have been verified/created in your SharePoint document library.
          </div>
        )}
        {testResult === 'error' && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            <strong>✗ Connection failed.</strong>{' '}
            {testMessage ? decodeURIComponent(testMessage) : 'Please check your credentials.'}
          </div>
        )}

        {/* Env-fallback notice */}
        {anyEnvOnly && (
          <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
            <strong>ℹ️ Environment variable fallback:</strong> Some fields are currently being read
            from environment variables (shown with an{' '}
            <span className="font-mono bg-blue-100 px-1 rounded">env</span> badge). Saving values
            here will override those environment variables without a server restart.
          </div>
        )}

        {/* Prerequisites note */}
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <strong>Prerequisites:</strong> Before configuring, you must register an Azure AD
          application and grant it the <code className="font-mono bg-amber-100 px-1 rounded">
            Sites.ReadWrite.All
          </code>{' '}
          application permission on Microsoft Graph (or{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">Files.ReadWrite.All</code> scoped
          to the target site). Note the Tenant ID, Client ID, and Client Secret from the app
          registration.
        </div>

        {/* Settings form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">Azure AD &amp; SharePoint Credentials</h2>
          <p className="text-xs text-gray-500 mb-5">
            All values are stored encrypted in the database and never exposed to the browser.
          </p>

          <form action={saveSharePointSettings} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldGroup
                label="Tenant ID"
                name="sharepoint.tenantId"
                type="text"
                defaultValue={effectiveTenantId}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                fromEnv={envOnlyTenantId}
              />
              <FieldGroup
                label="Client ID"
                name="sharepoint.clientId"
                type="text"
                defaultValue={effectiveClientId}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                fromEnv={envOnlyClientId}
              />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label
                    htmlFor="sharepoint.clientSecret"
                    className="block text-xs font-medium text-gray-700"
                  >
                    Client Secret
                  </label>
                  {envOnlySecret && <EnvBadge />}
                  {hasDbSecret && (
                    <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                      saved
                    </span>
                  )}
                </div>
                <input
                  id="sharepoint.clientSecret"
                  name="sharepoint.clientSecret"
                  type="password"
                  defaultValue=""
                  placeholder={
                    hasDbSecret || envOnlySecret ? '(leave blank to keep existing)' : ''
                  }
                  autoComplete="new-password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <FieldGroup
                label="SharePoint Site URL"
                name="sharepoint.siteUrl"
                type="url"
                defaultValue={effectiveSiteUrl}
                placeholder="https://contoso.sharepoint.com/sites/museum"
                fromEnv={envOnlySiteUrl}
              />
              <FieldGroup
                label="Document Library Name"
                name="sharepoint.driveName"
                type="text"
                defaultValue={effectiveDriveName}
                placeholder="Documents"
                fromEnv={envOnlyDriveName}
              />
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Save settings
              </button>
            </div>
          </form>
        </div>

        {/* Test connection */}
        {isConfigured && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-1">Test Connection</h2>
            <p className="text-xs text-gray-500 mb-4">
              Verifies credentials by connecting to SharePoint and ensuring the top-level folders
              (Training, Policies, Teams) exist — creating them if missing.
            </p>
            <form action={testSharePointConnection}>
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Test connection
              </button>
            </form>
          </div>
        )}

        {/* Clear DB overrides */}
        {anyDbValues && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Remove database overrides</h2>
            <p className="text-xs text-gray-500 mb-4">
              Clear all SharePoint values stored in the database. The system will fall back to
              environment variables (if set) or disable SharePoint integration entirely.
            </p>
            <form action={clearSharePointSettings}>
              <button
                type="submit"
                className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Clear database overrides
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

function EnvBadge() {
  return (
    <span className="text-xs text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-mono leading-none">
      env
    </span>
  );
}

function FieldGroup({
  label,
  name,
  type,
  defaultValue,
  placeholder,
  fromEnv,
}: {
  label: string;
  name: string;
  type: string;
  defaultValue: string;
  placeholder?: string;
  fromEnv?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label htmlFor={name} className="block text-xs font-medium text-gray-700">
          {label}
        </label>
        {fromEnv && <EnvBadge />}
      </div>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
