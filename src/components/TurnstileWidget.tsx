'use client';

import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
  onTokenChange: (token: string) => void;
  siteKey: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark';
          callback?: (token: string) => void;
          'error-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
    };
  }
}

export default function TurnstileWidget({ onTokenChange, siteKey }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Load Turnstile script if not already loaded
    if (!window.turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = () => {
        if (containerRef.current && window.turnstile) {
          try {
            widgetIdRef.current = window.turnstile.render(containerRef.current, {
              sitekey: siteKey,
              theme: 'light',
              callback: onTokenChange,
              'error-callback': () => {
                console.warn('[Turnstile] Widget error occurred');
              },
            });
          } catch (error) {
            console.error('[Turnstile] Failed to render widget:', error);
          }
        }
      };
      script.onerror = () => {
        console.error('[Turnstile] Failed to load script from Cloudflare');
      };
    } else if (containerRef.current && window.turnstile) {
      // Turnstile already loaded, render immediately
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'light',
        callback: onTokenChange,
      });
    }

    return () => {
      // Cleanup on unmount
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          console.error('Error removing Turnstile widget:', e);
        }
      }
    };
  }, [siteKey, onTokenChange]);

  return <div ref={containerRef} />;
}
