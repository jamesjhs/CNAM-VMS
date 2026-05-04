'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { randomBytes, randomInt, createHash, timingSafeEqual } from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import { getDb, now, packTs, unpackBool } from '@/lib/db';
import { signIn } from '@/auth';
import { verifyPassword } from '@/lib/password';
import { sendOtpEmail, sendPasswordResetEmail } from '@/lib/mail';
import { validatePasswordComplexity } from '@/lib/password-validation';
import { verifyTurnstileToken, isTurnstileEnabled } from '@/lib/turnstile';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const COMPLETION_TOKEN_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const RESET_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Brute-force protection
const MAX_OTP_ATTEMPTS = 5; // Maximum failed OTP attempts before the code is invalidated
const MAX_PASSWORD_ATTEMPTS = 10; // Maximum failed password attempts per email within the window
const PASSWORD_LOCKOUT_MS = 15 * 60 * 1000; // 15-minute sliding window for password attempts

const PENDING_UID_COOKIE = '_cnam_pending_uid';
const CALLBACK_URL_COOKIE = '_cnam_cb';
const KEEP_SIGNED_IN_COOKIE = '_cnam_keep';

/**
 * Extract the domain portion of an email address for log messages.
 * Only the domain is logged to limit PII exposure.
 * Uses lastIndexOf to handle emails with multiple @ signs correctly.
 */
function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1) : '(unknown domain)';
}

/**
 * Validate that a callbackUrl is a safe same-origin relative path (prevents open redirect).
 * Uses URL parsing to guard against bypass tricks like backslash-slashes or encoded separators.
 */
function safeCallbackUrl(url: string | null | undefined): string {
  const raw = (url ?? '').trim();
  try {
    // Resolve relative to a dummy origin so we can inspect host and pathname
    const parsed = new URL(raw, 'http://localhost');
    // Accept only same-origin paths (host must remain 'localhost' from the dummy base)
    if (parsed.origin === 'http://localhost') {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // Malformed URL — fall through to default
  }
  return '/dashboard';
}

// ---------------------------------------------------------------------------
// Step 1 — validate email + password, send OTP
// ---------------------------------------------------------------------------

export async function submitPassword(formData: FormData) {
  const email = (formData.get('email') as string | null)?.toLowerCase().trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const callbackUrl = safeCallbackUrl(formData.get('callbackUrl') as string | null);
  const keepSignedIn = formData.get('keepSignedIn') === '1';
  const turnstileToken = (formData.get('turnstileToken') as string | null) ?? '';

  console.log(`[auth] submitPassword: starting login flow for @${emailDomain(email)}`);

  // Verify Turnstile token if enabled
  if (isTurnstileEnabled) {
    console.log('[auth] submitPassword: verifying Turnstile token...');
    const isValidToken = await verifyTurnstileToken(turnstileToken);
    if (!isValidToken) {
      console.warn('[auth] submitPassword: Turnstile verification failed');
      redirect('/auth/signin?error=TurnstileVerificationFailed');
    }
    console.log('[auth] submitPassword: Turnstile verification passed');
  } else {
    console.log('[auth] submitPassword: Turnstile disabled, skipping verification');
  }

  if (!email || !password) {
    console.warn('[auth] submitPassword: missing email or password');
    redirect('/auth/signin?error=MissingFields');
  }

  const db = getDb();
  const cutoff = packTs(new Date());

  // Check password attempt rate limit before querying the user (prevents user enumeration timing)
  const pwFailIdentifier = `pw-fail:${email}`;
  const { n: recentPwFailures } = db.prepare(
    'SELECT COUNT(*) as n FROM verification_tokens WHERE identifier = ? AND expires > ?',
  ).get(pwFailIdentifier, cutoff) as { n: number };
  if (recentPwFailures >= MAX_PASSWORD_ATTEMPTS) {
    console.warn(`[auth] submitPassword: too many failed attempts for @${emailDomain(email)} — account temporarily locked (${recentPwFailures}/${MAX_PASSWORD_ATTEMPTS})`);
    redirect('/auth/signin?error=TooManyAttempts');
  }

  type UserRow = { id: string; passwordHash: string | null; status: string; mustChangePassword: number };
  const user = db.prepare('SELECT id, passwordHash, status, mustChangePassword FROM users WHERE email = ?').get(email) as UserRow | undefined;

  // Generic error — don't reveal whether the account exists
  if (!user || !user.passwordHash) {
    if (!user) {
      // No account found — most common cause is the database has not been seeded,
      // or the server is pointing at a different database file than the seed scripts.
      console.warn(
        `[auth] submitPassword: no account found for @${emailDomain(email)}. ` +
        `If the database was recently seeded, check that DB_ENCRYPTION_KEY and DATABASE_URL ` +
        `are identical between the seed scripts and the running server (see pm2 logs startup line).`,
      );
    } else {
      // The account exists but has no password set — set-initial-password was never run.
      console.warn(
        `[auth] submitPassword: account @${emailDomain(email)} exists but has no passwordHash — ` +
        `run  npm run db:set-initial-password  or  npm run db:reset-password`,
      );
    }
    // Record a failed attempt even for unknown users (prevents timing oracle)
    db.prepare('INSERT INTO verification_tokens (identifier, token, expires) VALUES (?,?,?)').run(
      pwFailIdentifier,
      randomBytes(12).toString('hex'),
      packTs(new Date(Date.now() + PASSWORD_LOCKOUT_MS)),
    );
    redirect('/auth/signin?error=InvalidCredentials');
  }

  if (user.status === 'SUSPENDED') {
    console.warn(`[auth] submitPassword: account @${emailDomain(email)} is SUSPENDED`);
    redirect('/auth/error?error=AccountSuspended');
  }

  console.log(`[auth] submitPassword: account found for @${emailDomain(email)}, verifying password...`);
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    console.warn(`[auth] submitPassword: password verification FAILED for @${emailDomain(email)}`);
    db.prepare('INSERT INTO verification_tokens (identifier, token, expires) VALUES (?,?,?)').run(
      pwFailIdentifier,
      randomBytes(12).toString('hex'),
      packTs(new Date(Date.now() + PASSWORD_LOCKOUT_MS)),
    );
    redirect('/auth/signin?error=InvalidCredentials');
  }

  console.log(`[auth] submitPassword: password VERIFIED for @${emailDomain(email)} — generating OTP...`);
  // Successful password check — clear any failure records for this email
  db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(pwFailIdentifier);

  // Generate 6-digit OTP (always exactly 6 digits, range 100000–999999)
  const otp = String(randomInt(100_000, 1_000_000));
  const identifier = `otp:${email}`;

  // Upsert OTP in verification_tokens (delete old then create new)
  db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(identifier);
  // Also clear any stale OTP failure records from a previous code
  db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(`otp-fail:${email}`);
  db.prepare('INSERT INTO verification_tokens (identifier, token, expires) VALUES (?,?,?)').run(
    identifier,
    // Hash the OTP before storage — protects against DB-level read; verify by hashing the submission
    createHash('sha256').update(otp).digest('hex'),
    packTs(new Date(Date.now() + OTP_EXPIRY_MS)),
  );
  console.log(`[auth] submitPassword: OTP stored in database for @${emailDomain(email)} — expires in 10 min`);

  // Send OTP email
  try {
    console.log(`[auth] submitPassword: sending OTP email to @${emailDomain(email)}...`);
    const mailResult = await sendOtpEmail(email, otp);
    if (!mailResult.success) {
      console.error(`[mail] Failed to send OTP email for @${emailDomain(email)}: ${mailResult.error}`);
      // Still proceed to verify page so user can retry; we'll show a warning there
    } else {
      console.log(`[mail] OTP email sent successfully for @${emailDomain(email)}`);
    }
  } catch (err) {
    // Log the SMTP error so it is visible in PM2 logs
    console.error('[mail] Failed to send OTP email:', err);
  }

  console.log(`[auth] submitPassword: OTP issued for @${emailDomain(email)} — sending verification code to user`);

  // Set pending cookies (httpOnly, short-lived)
  console.log(`[auth] submitPassword: setting pending cookies for user ${user.id}...`);
  const cookieStore = await cookies();
  cookieStore.set(PENDING_UID_COOKIE, user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  cookieStore.set(CALLBACK_URL_COOKIE, callbackUrl, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  cookieStore.set(KEEP_SIGNED_IN_COOKIE, keepSignedIn ? '1' : '0', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  redirect('/auth/verify-otp');
}

// ---------------------------------------------------------------------------
// Step 2 — verify OTP, create session
// ---------------------------------------------------------------------------

export async function submitOtp(formData: FormData) {
  const code = (formData.get('code') as string | null)?.trim().replace(/\s/g, '') ?? '';

  if (!code) {
    console.warn('[auth] submitOtp: no OTP code provided');
    redirect('/auth/verify-otp?error=MissingCode');
  }

  console.log('[auth] submitOtp: verifying OTP code...');
  const cookieStore = await cookies();
  const userId = cookieStore.get(PENDING_UID_COOKIE)?.value;
  const callbackUrl = safeCallbackUrl(cookieStore.get(CALLBACK_URL_COOKIE)?.value);
  const keepSignedIn = cookieStore.get(KEEP_SIGNED_IN_COOKIE)?.value === '1';

  if (!userId) {
    // Session expired or cookie missing — restart sign-in
    console.warn('[auth] submitOtp: no pending userId cookie found — session expired or cookie missing');
    redirect('/auth/signin?error=SessionExpired');
  }

  const db = getDb();
  type UserRow = { id: string; email: string; mustChangePassword: number };
  const user = db.prepare('SELECT id, email, mustChangePassword FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!user) {
    console.warn(`[auth] submitOtp: user ${userId} not found in database`);
    redirect('/auth/signin?error=InvalidCredentials');
  }

  console.log(`[auth] submitOtp: verifying OTP for user ${userId} (@${emailDomain(user.email)})`);
  const identifier = `otp:${user.email}`;
  const failIdentifier = `otp-fail:${user.email}`;
  const cutoff = packTs(new Date());

  // Check OTP attempt count before verifying — prevents brute force
  const { n: recentFailures } = db.prepare(
    'SELECT COUNT(*) as n FROM verification_tokens WHERE identifier = ? AND expires > ?',
  ).get(failIdentifier, cutoff) as { n: number };
  if (recentFailures >= MAX_OTP_ATTEMPTS) {
    // Too many wrong guesses: invalidate the OTP and force a fresh sign-in
    console.warn(`[auth] submitOtp: too many failed OTP attempts for @${emailDomain(user.email)} (${recentFailures}/${MAX_OTP_ATTEMPTS}) — code invalidated`);
    db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(identifier);
    db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(failIdentifier);
    cookieStore.delete(PENDING_UID_COOKIE);
    cookieStore.delete(CALLBACK_URL_COOKIE);
    redirect('/auth/signin?error=TooManyAttempts');
  }

  const tokenRecord = db.prepare(
    'SELECT token FROM verification_tokens WHERE identifier = ? AND expires > ?',
  ).get(identifier, cutoff) as { token: string } | undefined;

  if (!tokenRecord) {
    console.warn(`[auth] submitOtp: no valid OTP token found for @${emailDomain(user.email)} — code may have expired`);
  }

  const codeHash = createHash('sha256').update(code).digest('hex');
  const storedHash = tokenRecord?.token ?? '';
  const codeMatches =
    storedHash.length > 0 &&
    timingSafeEqual(Buffer.from(codeHash, 'hex'), Buffer.from(storedHash, 'hex'));

  if (!tokenRecord || !codeMatches) {
    // Record this failed attempt
    console.warn(`[auth] submitOtp: OTP code MISMATCH for @${emailDomain(user.email)}`);
    db.prepare('INSERT INTO verification_tokens (identifier, token, expires) VALUES (?,?,?)').run(
      failIdentifier,
      randomBytes(12).toString('hex'),
      packTs(new Date(Date.now() + OTP_EXPIRY_MS)),
    );
    redirect('/auth/verify-otp?error=OtpInvalid');
  }

  // OTP is correct — delete it (single-use) and clear failure records
  console.log(`[auth] submitOtp: OTP code VERIFIED for @${emailDomain(user.email)}`);
  db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(identifier);
  db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(failIdentifier);

  // Create a one-time completion token (2-minute TTL) — hash before storage
  console.log(`[auth] submitOtp: creating completion token for user ${userId}...`);
  const completionToken = randomBytes(32).toString('hex');
  const completionIdentifier = `auth:complete:${userId}`;
  db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(completionIdentifier);
  db.prepare('INSERT INTO verification_tokens (identifier, token, expires) VALUES (?,?,?)').run(
    completionIdentifier,
    createHash('sha256').update(completionToken).digest('hex'),
    packTs(new Date(Date.now() + COMPLETION_TOKEN_EXPIRY_MS)),
  );

  // Clear pending cookies
  console.log('[auth] submitOtp: clearing pending cookies...');
  cookieStore.delete(PENDING_UID_COOKIE);
  cookieStore.delete(CALLBACK_URL_COOKIE);
  cookieStore.delete(KEEP_SIGNED_IN_COOKIE);

  // Determine redirect target — force change-password if flagged
  const redirectTo = unpackBool(user.mustChangePassword)
    ? '/auth/change-password'
    : callbackUrl;

  console.log(`[auth] submitOtp: calling signIn for user ${userId}, redirecting to ${redirectTo}...`);
  // signIn throws a NEXT_REDIRECT internally; Next.js handles it as a redirect response
  await signIn('credentials', { userId, completionToken, keepSignedIn: keepSignedIn ? '1' : '0', redirectTo });
  console.log(`[auth] submitOtp: COMPLETE — user ${userId} successfully signed in`);
}

// ---------------------------------------------------------------------------
// Self-service password reset — step 1: request a reset link
// ---------------------------------------------------------------------------

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get('email') as string | null)?.toLowerCase().trim() ?? '';

  if (!email) {
    redirect('/auth/forgot-password?error=MissingEmail');
  }

  // Use the configured public URL — never trust Host/X-Forwarded-Proto headers
  // (prevents password-reset poisoning via Host header injection).
  const baseUrl = (process.env.AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}`).replace(/\/$/, '');

  // Always show a "success" response to prevent user enumeration
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;

  if (user) {
    const resetToken = randomBytes(32).toString('hex');
    const resetIdentifier = `pw-reset:${email}`;

    // Invalidate any existing reset token for this email
    db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(resetIdentifier);
    db.prepare('INSERT INTO verification_tokens (identifier, token, expires) VALUES (?,?,?)').run(
      resetIdentifier,
      // Hash the token before storage — raw token travels only in the email link
      createHash('sha256').update(resetToken).digest('hex'),
      packTs(new Date(Date.now() + RESET_TOKEN_EXPIRY_MS)),
    );

    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;
    try {
      const mailResult = await sendPasswordResetEmail(email, resetUrl);
      if (!mailResult.success) {
        console.error(`[mail] Failed to send password reset email for @${emailDomain(email)}: ${mailResult.error}`);
      }
    } catch (err) {
      // Log the SMTP error so it is visible in PM2 logs, but don't reveal it
      // to the caller — the user always sees the generic "email sent" response.
      console.error('[mail] Failed to send password reset email:', err);
    }
  }

  redirect('/auth/forgot-password?sent=1');
}

// ---------------------------------------------------------------------------
// Self-service password reset — step 2: set the new password via token
// ---------------------------------------------------------------------------

export async function completePasswordReset(formData: FormData) {
  const token = (formData.get('token') as string | null)?.trim() ?? '';
  const newPassword = (formData.get('newPassword') as string | null) ?? '';
  const confirmPassword = (formData.get('confirmPassword') as string | null) ?? '';

  if (!token || !newPassword || !confirmPassword) {
    redirect(`/auth/reset-password?token=${encodeURIComponent(token)}&error=MissingFields`);
  }

  if (newPassword !== confirmPassword) {
    redirect(`/auth/reset-password?token=${encodeURIComponent(token)}&error=PasswordMismatch`);
  }

  const complexityError = validatePasswordComplexity(newPassword);
  if (complexityError) {
    redirect(`/auth/reset-password?token=${encodeURIComponent(token)}&error=${complexityError}`);
  }

  const db = getDb();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const cutoff = packTs(new Date());

  // Look up the token by hash (tokens are stored hashed; we can't look up by raw value)
  const tokenRecord = db.prepare(
    `SELECT identifier FROM verification_tokens
     WHERE token = ? AND identifier LIKE 'pw-reset:%' AND expires > ?`,
  ).get(tokenHash, cutoff) as { identifier: string } | undefined;

  if (!tokenRecord) {
    redirect('/auth/reset-password?error=InvalidToken');
  }

  const email = tokenRecord.identifier.slice('pw-reset:'.length);
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (!user) {
    redirect('/auth/reset-password?error=InvalidToken');
  }

  const { hashPassword } = await import('@/lib/password');
  const hash = await hashPassword(newPassword);

  db.prepare('UPDATE users SET passwordHash=?, mustChangePassword=0, updatedAt=? WHERE id=?').run(hash, now(), user.id);

  // Invalidate the used token
  db.prepare('DELETE FROM verification_tokens WHERE identifier = ?').run(tokenRecord.identifier);

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    userId: user.id,
    action: 'PASSWORD_RESET',
    resource: 'User',
    resourceId: user.id,
  });

  redirect('/auth/signin?reset=1');
}
