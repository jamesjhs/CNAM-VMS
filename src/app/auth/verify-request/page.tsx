import Link from 'next/link';

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen bg-[#1a3a5c] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-[#1a3a5c] px-8 py-6 text-white text-center">
          <h1 className="text-xl font-bold">CNAM Volunteer Management</h1>
          <p className="text-blue-200 text-sm mt-1">City of Norwich Aviation Museum</p>
        </div>

        <div className="px-8 py-8 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
          <p className="text-gray-500 text-sm mb-6">
            A sign-in link has been sent to your email address. Click the link in the email to complete sign-in.
          </p>
          <p className="text-gray-400 text-xs">
            The link will expire in 24 hours. If you don&apos;t receive an email, check your spam folder.
          </p>
          <div className="mt-6">
            <Link href="/auth/signin" className="text-[#1a3a5c] hover:underline text-sm font-medium">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
