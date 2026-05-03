'use client';

import { useState, useRef, useTransition } from 'react';
import { deleteOwnAccount } from './actions';

export default function DeleteOwnAccountButton() {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Delete my account
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-sm text-red-800 font-medium mb-3">
        This action is <strong>permanent and cannot be undone</strong>. All your data, availability records,
        event sign-ups, and team memberships will be deleted.
      </p>
      <form
        ref={formRef}
        action={(fd) => startTransition(() => deleteOwnAccount(fd))}
        className="space-y-3"
      >
        <div>
          <label htmlFor="delete-password" className="block text-sm font-medium text-red-700 mb-1">
            Enter your current password to confirm deletion
          </label>
          <input
            id="delete-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {isPending ? 'Deleting…' : 'Yes, permanently delete my account'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
