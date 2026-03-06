import { requireAuth } from '@/lib/auth-helpers';
import { changePassword } from './actions';

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireAuth();
  const { error } = await searchParams;

  const errorMessages: Record<string, string> = {
    MissingFields: 'Please fill in all fields.',
    PasswordMismatch: 'New passwords do not match.',
    TooShort: 'New password must be at least 8 characters.',
    WrongCurrentPassword: 'Your current password is incorrect.',
    NoPassword: 'No password is set for this account. Contact your administrator.',
  };
  const errorMsg = error ? (errorMessages[error] ?? 'Something went wrong. Please try again.') : null;

  const isMandatory = user.mustChangePassword;

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
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            {isMandatory ? 'Set your password' : 'Change password'}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {isMandatory
              ? 'You must set a new password before continuing. Use a strong password of at least 8 characters.'
              : 'Enter your current password and choose a new one.'}
          </p>

          {isMandatory && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              ⚠️ Your password must be changed before you can access the system.
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errorMsg}
            </div>
          )}

          <form action={changePassword} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {isMandatory ? 'Temporary / current password' : 'Current password'}
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

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
              {isMandatory ? 'Set password & continue' : 'Change password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
