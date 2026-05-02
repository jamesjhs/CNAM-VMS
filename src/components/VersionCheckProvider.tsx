'use client';

import { useVersionCheck } from '@/hooks/useVersionCheck';

export function VersionCheckProvider({ children }: { children: React.ReactNode }) {
  const { hasUpdate } = useVersionCheck();

  return (
    <>
      {hasUpdate && (
        <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white text-center py-2 z-50">
          New version available. Reloading...
        </div>
      )}
      {children}
    </>
  );
}
