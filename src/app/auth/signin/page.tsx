import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import SignInForm from './SignInForm';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; reset?: string }>;
}) {
  const { callbackUrl, error, reset } = await searchParams;
  const session = await auth();
  if (session) redirect(callbackUrl ?? '/dashboard');

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
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h2>
          <p className="text-gray-500 text-sm mb-6">
            Enter your email and password. A one-time verification code will be sent to your inbox.
          </p>

          {reset && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              ✓ Your password has been reset. You can now sign in with your new password.
            </div>
          )}

          <SignInForm callbackUrl={callbackUrl} error={error} reset={!!reset} />

          <p className="mt-6 text-center text-xs text-gray-400">
            Don&apos;t have an account? Contact your administrator to request access.
          </p>
        </div>
      </div>
    </div>
  );
}
