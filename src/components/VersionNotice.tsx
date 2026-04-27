'use client';

import { useEffect, useRef } from 'react';
import { APP_VERSION, VERSION_STORAGE_KEY } from '@/lib/version';

export default function VersionNotice() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seen = localStorage.getItem(VERSION_STORAGE_KEY);
    if (seen !== APP_VERSION && ref.current) {
      ref.current.style.display = 'block';
    }
  }, []);

  function dismiss() {
    localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
    if (ref.current) ref.current.style.display = 'none';
  }

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      style={{ display: 'none' }}
      className="fixed top-3 right-3 z-50 max-w-xs rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg"
    >
      <p className="text-sm text-emerald-900">
        CNAM VMS updated to version <strong>{APP_VERSION}</strong>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-1.5 text-xs font-medium text-emerald-800 underline hover:text-emerald-900 transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
