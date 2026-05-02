'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION, VERSION_STORAGE_KEY } from '@/lib/version';

export function useVersionCheck(pollIntervalMs = 30000) {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    // Store the version we're running on startup
    localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);

    const checkVersion = async () => {
      try {
        const response = await fetch('/api/version');
        if (!response.ok) {
          // Silently skip if API is down (502, etc)
          console.debug(`[Version] API returned ${response.status}, skipping check`);
          return;
        }
        const data = (await response.json()) as { version: string };
        const remoteVersion = data.version;

        // If server version differs from client version, trigger reload
        if (remoteVersion !== APP_VERSION) {
          setHasUpdate(true);
          // Auto-reload after a short delay to notify user
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (error) {
        // Silently ignore version check failures - not critical to operation
        console.debug('Failed to check version (non-critical):', error instanceof Error ? error.message : error);
      }
    };

    // Check immediately
    checkVersion();

    // Then poll at intervals
    const interval = setInterval(checkVersion, pollIntervalMs);

    return () => clearInterval(interval);
  }, [pollIntervalMs]);

  return { hasUpdate };
}
