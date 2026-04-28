'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          if (process.env.NODE_ENV !== 'production') {
            console.error('SW registration failed:', err);
          }
        });
    }
  }, []);

  return null;
}
