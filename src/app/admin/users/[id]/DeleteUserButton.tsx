'use client';

import { deleteUser } from '../actions';

export default function DeleteUserButton({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  return (
    <form action={deleteUser.bind(null, userId)}>
      <button
        type="submit"
        className="w-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        onClick={(e) => {
          if (!confirm(`Delete user ${userEmail}? This cannot be undone.`)) {
            e.preventDefault();
          }
        }}
      >
        Delete User Account
      </button>
    </form>
  );
}
