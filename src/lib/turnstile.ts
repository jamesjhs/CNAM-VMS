export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

export const isTurnstileEnabled = !!TURNSTILE_SITE_KEY && !!TURNSTILE_SECRET_KEY;

// ── Module-load diagnostic (server-side only) ─────────────────────────────────
// This runs once when the module is first imported on the server.
// If both keys are set but logins are still failing, the most common cause is
// that TURNSTILE_SITE_KEY is not prefixed with NEXT_PUBLIC_, which means the
// browser-side client components (SignInForm, TurnstileWidget) see the key as
// undefined, never render the widget, and submit the form without a token.
console.log(
  '[Turnstile] Module initialised —',
  `isTurnstileEnabled=${isTurnstileEnabled}`,
  `| SITE_KEY set=${!!TURNSTILE_SITE_KEY}`,
  `| SECRET_KEY set=${!!TURNSTILE_SECRET_KEY}`,
);
if (TURNSTILE_SITE_KEY && !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
  console.warn(
    '[Turnstile] WARNING: TURNSTILE_SITE_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is NOT set. ' +
    'Next.js client components cannot access env vars that lack the NEXT_PUBLIC_ prefix. ' +
    'The browser will see TURNSTILE_SITE_KEY as undefined, so isTurnstileEnabled will be false ' +
    'in SignInForm — no widget will render and no token will be generated. ' +
    'The server still sees the key as set and will reject any login attempt without a token. ' +
    'Fix: add NEXT_PUBLIC_TURNSTILE_SITE_KEY=<same value> to your .env file and rebuild.',
  );
}
// ─────────────────────────────────────────────────────────────────────────────

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  console.log(
    '[Turnstile] verifyTurnstileToken called —',
    `isTurnstileEnabled=${isTurnstileEnabled}`,
    `| token present=${!!token}`,
    `| token length=${token.length}`,
  );

  if (!isTurnstileEnabled) {
    console.log('[Turnstile] Turnstile is disabled (keys not configured) — allowing request through');
    return true;
  }

  if (!token) {
    console.warn(
      '[Turnstile] No token provided — rejecting. ' +
      'If this happens on every login attempt, the client is not generating a token. ' +
      'Check that NEXT_PUBLIC_TURNSTILE_SITE_KEY is set in .env (not just TURNSTILE_SITE_KEY).',
    );
    return false;
  }

  console.log('[Turnstile] Calling Cloudflare siteverify API...');
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET_KEY, response: token }),
    });

    console.log(`[Turnstile] Cloudflare API response status: ${response.status} ${response.statusText}`);

    const data = (await response.json()) as TurnstileVerifyResponse;
    console.log(
      '[Turnstile] Cloudflare API response body —',
      `success=${data.success}`,
      `| error-codes=${JSON.stringify(data['error-codes'] ?? [])}`,
      `| hostname=${data.hostname ?? '(not returned)'}`,
      `| challenge_ts=${data.challenge_ts ?? '(not returned)'}`,
    );

    if (!data.success) {
      console.warn(
        '[Turnstile] Verification FAILED —',
        `error-codes: ${(data['error-codes'] ?? []).join(', ') || '(none)'}`,
      );
    } else {
      console.log('[Turnstile] Verification PASSED');
    }

    return data.success === true;
  } catch (error) {
    // Network error reaching Cloudflare — fail open to avoid locking out legitimate users
    console.error('[Turnstile] Network/parse error calling Cloudflare siteverify:', error);
    console.warn('[Turnstile] Failing OPEN due to network error — allowing request through');
    return true;
  }
}
