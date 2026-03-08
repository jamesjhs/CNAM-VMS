import Link from 'next/link';
import { completePasswordReset } from '../actions';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  const errorMessages: Record<string, string> = {
    MissingFields: 'Please fill in all fields.',
    PasswordMismatch: 'Passwords do not match.',
    TooShort: 'Password must be at least 8 characters.',
    InvalidToken: 'This reset link is invalid or has expired. Please request a new one.',
  };
  const errorMsg = error ? (errorMessages[error] ?? 'Something went wrong. Please try again.') : null;

  if (!token || error === 'InvalidToken') {
    return (
      <div className="min-h-screen bg-[#1a3a5c] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
          <div className="bg-[#1a3a5c] px-8 py-6 text-white text-center">
            <h1 className="text-xl font-bold">CNAM Volunteer Management</h1>
            <p className="text-blue-200 text-sm mt-1">City of Norwich Aviation Museum</p>
          </div>
          <div className="px-8 py-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Link expired or invalid</h2>
            <p className="text-gray-500 text-sm mb-6">
              This password reset link is invalid or has expired. Reset links are valid for 24 hours.
            </p>
            <Link
              href="/auth/forgot-password"
              className="inline-block bg-[#1a3a5c] hover:bg-[#2d5986] text-white font-semibold py-2.5 px-6 rounded-lg transition-colors text-sm"
            >
              Request a new link
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
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Set new password</h2>
          <p className="text-gray-500 text-sm mb-6">
            Choose a strong password of at least 8 characters.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errorMsg}
            </div>
          )}

          <form action={completePasswordReset} className="space-y-4">
            <input type="hidden" name="token" value={token} />

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:border-transparent"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#1a3a5c] hover:bg-[#2d5986] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              Set password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
