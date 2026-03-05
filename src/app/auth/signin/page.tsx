import { signIn } from '@/auth';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
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
            Enter your email address and we&apos;ll send you a magic link.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error === 'OAuthAccountNotLinked'
                ? 'This email is already associated with another account.'
                : 'Something went wrong. Please try again.'}
            </div>
          )}

          <form
            action={async (formData: FormData) => {
              'use server';
              const email = formData.get('email') as string;
              await signIn('email', {
                email: email.toLowerCase().trim(),
                redirectTo: callbackUrl ?? '/dashboard',
              });
            }}
            className="space-y-4"
          >
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
              Send magic link
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            Don&apos;t have an account? Contact your administrator to request access.
          </p>
        </div>
      </div>
    </div>
  );
}
