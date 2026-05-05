'use client';

import { useEffect, useId, useRef } from 'react';

// Script element ID used to ensure the Cloudflare script is only appended once.
const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';

interface TurnstileWidgetProps {
  siteKey: string;
  onTokenChange: (token: string) => void;
}

export default function TurnstileWidget({ siteKey, onTokenChange }: TurnstileWidgetProps) {
  // Stable, unique names for the window-level callbacks that Cloudflare's script
  // calls by name.  useId() gives a stable ID for the lifetime of this component
  // instance; replacing ":" keeps the string safe as a JS identifier.
  const uid = useId().replace(/:/g, '_');
  const successCb = `__tsCb${uid}`;
  const expiredCb = `__tsExp${uid}`;
  const errorCb   = `__tsErr${uid}`;

  // Keep a ref to the latest callback so the window-level functions always call
  // the current version.  Updated via a layout effect (not during render).
  const onTokenChangeRef = useRef(onTokenChange);
  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w[successCb] = (token: string) => onTokenChangeRef.current(token);
    w[expiredCb] = () => onTokenChangeRef.current('');
    w[errorCb]   = () => onTokenChangeRef.current('');

    // Append the Cloudflare Turnstile script once per page load.  The script
    // automatically finds every element with class="cf-turnstile" and renders
    // the challenge widget inside it, so no manual window.turnstile.render()
    // call is needed.
    if (!document.getElementById(TURNSTILE_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id    = TURNSTILE_SCRIPT_ID;
      script.src   = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      delete w[successCb];
      delete w[expiredCb];
      delete w[errorCb];
    };
  // successCb / expiredCb / errorCb are all derived from useId(), so they are
  // stable for the lifetime of this component.  The effect runs exactly once per
  // mount — it never destroys/recreates the widget due to a callback identity change.
  }, [successCb, expiredCb, errorCb]);

  // Cloudflare's script auto-discovers elements with class="cf-turnstile".
  // On challenge completion it:
  //   1. Calls the data-callback function (→ onTokenChange → SignInForm state)
  //   2. Injects <input type="hidden" name="cf-turnstile-response"> into the
  //      nearest ancestor <form>, so the token is also in FormData automatically.
  return (
    <div
      className="cf-turnstile"
      data-sitekey={siteKey}
      data-theme="light"
      data-callback={successCb}
      data-expired-callback={expiredCb}
      data-error-callback={errorCb}
    />
  );
}
