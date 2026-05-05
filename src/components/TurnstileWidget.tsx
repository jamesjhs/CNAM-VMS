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
          'expired-callback'?: () => void;
          'timeout-callback'?: () => void;
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

  console.log(`[TurnstileWidget] Rendering — siteKey=${siteKey ? siteKey.substring(0, 8) + '...' : '(undefined/empty)'}`);
  if (!siteKey) {
    console.error(
      '[TurnstileWidget] siteKey prop is empty/undefined — widget cannot render. ' +
      'Ensure NEXT_PUBLIC_TURNSTILE_SITE_KEY is set in .env and the app was rebuilt after the change.',
    );
  }

  const renderWidget = (container: HTMLDivElement) => {
    if (!window.turnstile) {
      console.warn('[TurnstileWidget] renderWidget called but window.turnstile is not available yet');
      return;
    }
    console.log(`[TurnstileWidget] Calling window.turnstile.render — siteKey prefix: ${siteKey.substring(0, 8)}...`);
    try {
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token: string) => {
          console.log(`[TurnstileWidget] Token received — length=${token.length}, prefix=${token.substring(0, 10)}...`);
          onTokenChange(token);
        },
        'error-callback': () => {
          console.error(
            '[TurnstileWidget] Widget reported an error. ' +
            'Possible causes: invalid sitekey, network or CSP blocking challenges.cloudflare.com, ' +
            'or the site domain is not listed in the Turnstile dashboard allowed-origins.',
          );
          onTokenChange('');
        },
        'expired-callback': () => {
          console.warn('[TurnstileWidget] Token expired — user must re-verify before submitting');
          onTokenChange('');
        },
        'timeout-callback': () => {
          console.warn('[TurnstileWidget] Challenge timed out — token cleared');
          onTokenChange('');
        },
      });
      console.log(`[TurnstileWidget] Widget rendered successfully — widgetId=${widgetIdRef.current}`);
    } catch (error) {
      console.error('[TurnstileWidget] window.turnstile.render threw an error:', error);
    }
  };

  useEffect(() => {
    // Load Turnstile script if not already loaded
    if (!window.turnstile) {
      console.log('[TurnstileWidget] window.turnstile not present — loading script from Cloudflare...');
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = () => {
        console.log('[TurnstileWidget] Script loaded — window.turnstile available:', !!window.turnstile);
        if (containerRef.current) {
          renderWidget(containerRef.current);
        }
      };
      script.onerror = () => {
        console.error(
          '[TurnstileWidget] Failed to load https://challenges.cloudflare.com/turnstile/v0/api.js. ' +
          'Check network connectivity and that Content-Security-Policy is not blocking this URL.',
        );
      };
    } else if (containerRef.current) {
      // Turnstile already loaded, render immediately
      console.log('[TurnstileWidget] window.turnstile already present — rendering widget immediately');
      renderWidget(containerRef.current);
    }

    return () => {
      // Cleanup on unmount
      if (widgetIdRef.current && window.turnstile) {
        try {
          console.log(`[TurnstileWidget] Removing widget ${widgetIdRef.current} on unmount`);
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          console.error('[TurnstileWidget] Error removing widget on unmount:', e);
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, onTokenChange]);

  return <div ref={containerRef} />;
}
