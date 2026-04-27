'use client';

import { useEffect, useRef } from 'react';
import { APP_VERSION, VERSION_NOTICE_STORAGE_KEY } from '@/lib/version';

export default function VersionNotice() {
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seenVersion = localStorage.getItem(VERSION_NOTICE_STORAGE_KEY);
    if (seenVersion !== APP_VERSION && noticeRef.current) {
      noticeRef.current.style.display = 'block';
    }
  }, []);

  function dismiss() {
    localStorage.setItem(VERSION_NOTICE_STORAGE_KEY, APP_VERSION);
    if (noticeRef.current) noticeRef.current.style.display = 'none';
  }

  return (
    <div
      ref={noticeRef}
      role="status"
      aria-live="polite"
      style={{ display: 'none' }}
      className="fixed top-3 right-3 z-50 max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg"
    >
      <p className="text-sm text-emerald-900">
        CNAM VMS has updated to version <strong>{APP_VERSION}</strong>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2 text-xs font-medium text-emerald-800 underline hover:text-emerald-900"
      >
        Dismiss
      </button>
    </div>
  );
}
