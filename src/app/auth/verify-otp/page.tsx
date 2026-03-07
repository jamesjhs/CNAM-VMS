import { submitOtp } from '../actions';
import Link from 'next/link';

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const errorMessages: Record<string, string> = {
    OtpInvalid: 'That code is incorrect or has expired. Please check your email and try again.',
    MissingCode: 'Please enter the verification code from your email.',
    TooManyAttempts: 'Too many incorrect attempts. For your security, please sign in again and request a new code.',
  };
  const errorMsg = error ? (errorMessages[error] ?? 'Something went wrong. Please try again.') : null;

  return (
    <div className="min-h-screen bg-[#1a3a5c] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a3a5c] px-8 py-6 text-white text-center">
          <h1 className="text-xl font-bold">CNAM Volunteer Management</h1>
          <p className="text-blue-200 text-sm mt-1">City of Norwich Aviation Museum</p>
        </div>

        {/* Body */}
        <div className="px-8 py-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">📧</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Check your email</h2>
            <p className="text-gray-500 text-sm">
              We&apos;ve sent a 6-digit verification code to your email address.
              Enter it below to complete sign-in.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errorMsg}
            </div>
          )}

          <form action={submitOtp} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Verification code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-2xl font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#1a3a5c] hover:bg-[#2d5986] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              Verify code
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-400">
            Code expires in 10 minutes. Check your spam folder if you don&apos;t see it.
          </p>

          <div className="mt-4 text-center">
            <Link
              href="/auth/signin"
              className="text-[#1a3a5c] hover:underline text-sm font-medium"
            >
              ← Start over
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
