import Link from 'next/link';
import { requestPasswordReset } from '../actions';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  const errorMessages: Record<string, string> = {
    MissingEmail: 'Please enter your email address.',
  };
  const errorMsg = error ? (errorMessages[error] ?? 'Something went wrong. Please try again.') : null;

  if (sent) {
    return (
      <div className="min-h-screen bg-[#1a3a5c] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
          <div className="bg-[#1a3a5c] px-8 py-6 text-white text-center">
            <h1 className="text-xl font-bold">CNAM Volunteer Management</h1>
            <p className="text-blue-200 text-sm mt-1">City of Norwich Aviation Museum</p>
          </div>
          <div className="px-8 py-8 text-center">
            <div className="text-6xl mb-4 inline-block">✓</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              If an account exists for that email address, we&apos;ve sent a password reset link.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-6">
              <p className="text-sm text-blue-900"><strong>What happens next:</strong></p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1">
                <li>• Check your email (including spam folder)</li>
                <li>• Click the reset link in the email</li>
                <li>• Set a new password</li>
                <li>• Sign in with your new password</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              The reset link will expire in <strong>24 hours</strong>.
            </p>
            <Link
              href="/auth/signin"
              className="text-[#1a3a5c] hover:underline text-sm font-medium"
            >
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a3a5c] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-[#1a3a5c] px-8 py-6 text-white text-center">
          <h1 className="text-xl font-bold">CNAM Volunteer Management</h1>
          <p className="text-blue-200 text-sm mt-1">City of Norwich Aviation Museum</p>
        </div>

        <div className="px-8 py-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Forgot password?</h2>
          <p className="text-gray-500 text-sm mb-6">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errorMsg}
            </div>
          )}

          <form action={requestPasswordReset} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#1a3a5c] hover:bg-[#2d5986] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              Send reset link
            </button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link href="/auth/signin" className="text-[#1a3a5c] hover:underline">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
