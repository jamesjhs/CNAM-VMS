export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY;
export const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

export const isTurnstileEnabled = !!TURNSTILE_SITE_KEY && !!TURNSTILE_SECRET_KEY;

interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  error_codes?: string[];
  score?: number;
  score_reason?: string[];
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  if (!isTurnstileEnabled) {
    console.log('[Turnstile] Verification skipped: Turnstile not configured');
    return true; // Allow if not configured
  }

  if (!token) {
    console.warn('[Turnstile] No token provided');
    console.warn('[Turnstile] Keys configured: SITE_KEY=' + (!!TURNSTILE_SITE_KEY), 'SECRET_KEY=' + (!!TURNSTILE_SECRET_KEY));
    // If Turnstile is enabled but no token, reject
    return false;
  }

  console.log(`[Turnstile] Verifying token (length: ${token.length}, first 20 chars: ${token.substring(0, 20)}...)`);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });

    const data = (await response.json()) as TurnstileVerifyResponse;
    const isValid = data.success === true;
    console.log('[Turnstile] Token verification:', isValid ? 'PASSED' : 'FAILED', { 
      hostname: data.hostname, 
      score: data.score,
      error_codes: data.error_codes?.join(','),
    });
    if (!isValid) {
      console.warn('[Turnstile] Verification failed with errors:', data.error_codes?.join(', '));
    }
    return isValid;
  } catch (error) {
    console.error('[Turnstile] Verification error:', error);
    // Be lenient on network errors - allow login to proceed
    // This prevents CAPTCHA from blocking legitimate users
    console.warn('[Turnstile] Allowing login despite verification error');
    return true;
  }
}
