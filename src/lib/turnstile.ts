export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

export const isTurnstileEnabled = !!TURNSTILE_SITE_KEY && !!TURNSTILE_SECRET_KEY;

interface TurnstileVerifyResponse {
  success: boolean;
  error_codes?: string[];
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  if (!isTurnstileEnabled) {
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET_KEY, response: token }),
    });

    const data = (await response.json()) as TurnstileVerifyResponse;
    if (!data.success) {
      console.warn('[Turnstile] Verification failed:', data.error_codes?.join(', '));
    }
    return data.success === true;
  } catch (error) {
    // Network error reaching Cloudflare — fail open to avoid locking out legitimate users
    console.error('[Turnstile] Verification error:', error);
    return true;
  }
}
