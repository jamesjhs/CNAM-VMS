// NEXT_PUBLIC_ prefix is required so Next.js includes this value in the client
// bundle and browser-side components (SignInForm, TurnstileWidget) can read it.
// TURNSTILE_SECRET_KEY must NOT have the prefix — it is server-side only.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

export const isTurnstileEnabled = !!TURNSTILE_SITE_KEY && !!TURNSTILE_SECRET_KEY;

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
    console.warn('[Turnstile] No token provided — rejecting. Check that NEXT_PUBLIC_TURNSTILE_SITE_KEY is set in .env and the app was rebuilt.');
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
