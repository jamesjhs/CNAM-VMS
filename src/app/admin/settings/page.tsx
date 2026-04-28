import { requireCapability } from '@/lib/auth-helpers';
import NavBar from '@/components/NavBar';
import { getDb } from '@/lib/db';
import Link from 'next/link';
import { saveSmtpSettings, clearSmtpSettings } from './actions';

export const metadata = {
  title: 'System Settings — Admin',
};

/** Read a single system_settings value; returns null if absent. */
function getSetting(db: ReturnType<typeof getDb>, key: string): string | null {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export default async function AdminSettingsPage() {
  await requireCapability('admin:settings.write');

  const db = getDb();

  // Current DB values (may be null if not yet set — env var is used as fallback)
  const dbHost    = getSetting(db, 'smtp.host');
  const dbPort    = getSetting(db, 'smtp.port');
  const dbUser    = getSetting(db, 'smtp.user');
  const dbFrom    = getSetting(db, 'smtp.from');
  const dbSecure  = getSetting(db, 'smtp.secure');
  const dbReqTls  = getSetting(db, 'smtp.requireTls');
  const dbRejectU = getSetting(db, 'smtp.tlsRejectUnauthorized');
  const hasDbPass = getSetting(db, 'smtp.password') !== null;

  // Effective display values — DB overrides env, show placeholder if neither is set
  const effectiveHost    = dbHost    ?? process.env.EMAIL_SERVER_HOST    ?? '';
  const effectivePort    = dbPort    ?? process.env.EMAIL_SERVER_PORT    ?? '587';
  const effectiveUser    = dbUser    ?? process.env.EMAIL_SERVER_USER    ?? '';
  const effectiveFrom    = dbFrom    ?? process.env.EMAIL_FROM           ?? '';
  const effectiveSecure  = dbSecure  ?? process.env.EMAIL_SERVER_SECURE  ?? 'false';
  const effectiveReqTls  = dbReqTls  ?? process.env.EMAIL_SERVER_REQUIRE_TLS ?? 'false';
  const effectiveRejectU = dbRejectU ?? process.env.EMAIL_TLS_REJECT_UNAUTHORIZED ?? 'true';

  // Flags to show the user where the value currently comes from
  const envOnlyHost    = !dbHost    && !!process.env.EMAIL_SERVER_HOST;
  const envOnlyPort    = !dbPort    && !!process.env.EMAIL_SERVER_PORT;
  const envOnlyUser    = !dbUser    && !!process.env.EMAIL_SERVER_USER;
  const envOnlyPass    = !hasDbPass && !!process.env.EMAIL_SERVER_PASSWORD;
  const envOnlyFrom    = !dbFrom    && !!process.env.EMAIL_FROM;
  const envOnlySecure  = !dbSecure  && !!process.env.EMAIL_SERVER_SECURE;
  const envOnlyReqTls  = !dbReqTls  && !!process.env.EMAIL_SERVER_REQUIRE_TLS;
  const envOnlyRejectU = !dbRejectU && !!process.env.EMAIL_TLS_REJECT_UNAUTHORIZED;

  const anyEnvOnly = envOnlyHost || envOnlyPort || envOnlyUser || envOnlyPass ||
                     envOnlyFrom || envOnlySecure || envOnlyReqTls || envOnlyRejectU;

  const anyDbValues = dbHost || dbPort || dbUser || hasDbPass || dbFrom ||
                      dbSecure || dbReqTls || dbRejectU;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-2">
          <Link href="/admin" className="hover:text-gray-700">Admin</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">System Settings</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">System Settings</h1>
          <p className="text-gray-500">Configure SMTP email delivery settings. Changes take effect immediately without a server restart.</p>
        </div>

        {anyEnvOnly && (
          <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
            <strong>ℹ️ Environment variable fallback:</strong> Some fields are currently being read from
            environment variables (shown with a <span className="font-mono bg-blue-100 px-1 rounded">env</span> badge).
            Saving values here will override those environment variables without requiring a server restart.
          </div>
        )}

        {/* SMTP Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">SMTP Email Settings</h2>
          <p className="text-xs text-gray-500 mb-5">
            Used for sending 2FA codes and password-reset emails.
            If no host is configured, emails are written to the server log instead.
          </p>

          <form action={saveSmtpSettings} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldGroup
                label="SMTP Host"
                name="smtp.host"
                type="text"
                defaultValue={effectiveHost}
                placeholder="smtp.example.com"
                fromEnv={envOnlyHost}
              />
              <FieldGroup
                label="SMTP Port"
                name="smtp.port"
                type="text"
                defaultValue={effectivePort}
                placeholder="587"
                fromEnv={envOnlyPort}
              />
              <FieldGroup
                label="SMTP Username"
                name="smtp.user"
                type="text"
                defaultValue={effectiveUser}
                placeholder="noreply@example.com"
                fromEnv={envOnlyUser}
                autoComplete="off"
              />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label htmlFor="smtp.password" className="block text-xs font-medium text-gray-700">
                    SMTP Password
                  </label>
                  {envOnlyPass && <EnvBadge />}
                  {hasDbPass && <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">saved</span>}
                </div>
                <input
                  id="smtp.password"
                  name="smtp.password"
                  type="password"
                  defaultValue=""
                  placeholder={hasDbPass || envOnlyPass ? '(leave blank to keep existing)' : ''}
                  autoComplete="new-password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <FieldGroup
                label="From Address"
                name="smtp.from"
                type="text"
                defaultValue={effectiveFrom}
                placeholder={'CNAM VMS <noreply@example.com>'}
                fromEnv={envOnlyFrom}
              />
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">TLS / Security Options</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SelectGroup
                  label="Implicit TLS (port 465)"
                  name="smtp.secure"
                  defaultValue={effectiveSecure}
                  fromEnv={envOnlySecure}
                  options={[
                    { value: 'false', label: 'Disabled (default)' },
                    { value: 'true',  label: 'Enabled' },
                  ]}
                />
                <SelectGroup
                  label="Force STARTTLS"
                  name="smtp.requireTls"
                  defaultValue={effectiveReqTls}
                  fromEnv={envOnlyReqTls}
                  options={[
                    { value: 'false', label: 'Disabled (default)' },
                    { value: 'true',  label: 'Enabled' },
                  ]}
                />
                <SelectGroup
                  label="Reject unauthorized certs"
                  name="smtp.tlsRejectUnauthorized"
                  defaultValue={effectiveRejectU}
                  fromEnv={envOnlyRejectU}
                  options={[
                    { value: 'true',  label: 'Enabled (default)' },
                    { value: 'false', label: 'Disabled (self-signed)' },
                  ]}
                />
              </div>
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

        {/* Clear / reset section */}
        {anyDbValues && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Remove database overrides</h2>
            <p className="text-xs text-gray-500 mb-4">
              Clear all SMTP values stored in the database. The system will fall back to environment
              variables (if set) or disable email sending entirely.
            </p>
            <form action={clearSmtpSettings}>
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
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  defaultValue: string;
  placeholder?: string;
  fromEnv?: boolean;
  autoComplete?: string;
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
        autoComplete={autoComplete}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function SelectGroup({
  label,
  name,
  defaultValue,
  fromEnv,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  fromEnv?: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label htmlFor={name} className="block text-xs font-medium text-gray-700">
          {label}
        </label>
        {fromEnv && <EnvBadge />}
      </div>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
