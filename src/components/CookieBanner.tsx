'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'cookie-consent';

/**
 * Cookie consent banner.
 * Uses direct DOM manipulation (via ref) to show/hide without calling
 * setState inside a useEffect, which satisfies the react-hooks/set-state-in-effect rule.
 */
export default function CookieBanner() {
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored && bannerRef.current) {
      bannerRef.current.style.display = 'block';
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    if (bannerRef.current) bannerRef.current.style.display = 'none';
  }

  function dismiss() {
    localStorage.setItem(CONSENT_KEY, 'acknowledged');
    if (bannerRef.current) bannerRef.current.style.display = 'none';
  }

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-live="polite"
      aria-label="Cookie notice"
      style={{ display: 'none' }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a3a5c] text-white shadow-lg border-t border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="flex-1 text-sm leading-relaxed">
          <span className="font-semibold">🍪 Cookie Notice</span> — This site uses essential cookies
          only, which are strictly necessary for authentication and security. We do not use tracking
          or advertising cookies.{' '}
          <Link href="/privacy" className="underline hover:text-amber-300 transition-colors">
            Privacy &amp; Cookie Policy
          </Link>
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={accept}
            className="bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            Accept
          </button>
          <button
            onClick={dismiss}
            className="text-gray-300 hover:text-white text-sm underline transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
