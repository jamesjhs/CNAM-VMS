import Link from 'next/link';

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration. Please contact the administrator.',
  AccessDenied: 'You do not have permission to sign in.',
  Verification: 'The sign-in link is invalid or has expired. Please request a new one.',
  AccountSuspended: 'Your account has been suspended. Please contact the administrator.',
  AccountPending: 'Your account is pending approval. Please contact the administrator.',
  Default: 'An error occurred during sign in. Please try again.',
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorKey = searchParams.error ?? 'Default';
  const message = ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen bg-[#1a3a5c] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-[#1a3a5c] px-8 py-6 text-white text-center">
          <h1 className="text-xl font-bold">CNAM Volunteer Management</h1>
          <p className="text-blue-200 text-sm mt-1">City of Norwich Aviation Museum</p>
        </div>

        <div className="px-8 py-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign-in Error</h2>
          <p className="text-gray-500 text-sm mb-6">{message}</p>

          <Link
            href="/auth/signin"
            className="inline-block bg-[#1a3a5c] hover:bg-[#2d5986] text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm"
          >
            Try again
          </Link>
        </div>
      </div>
    </div>
  );
}
