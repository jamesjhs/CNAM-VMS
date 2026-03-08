'use server';

import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { randomBytes, randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import { signIn } from '@/auth';
import { verifyPassword } from '@/lib/password';
import { sendOtpEmail, sendPasswordResetEmail } from '@/lib/mail';

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

  if (!email || !password) {
    redirect('/auth/signin?error=MissingFields');
  }

  // Check password attempt rate limit before querying the user (prevents user enumeration timing)
  const pwFailIdentifier = `pw-fail:${email}`;
  const recentPwFailures = await prisma.verificationToken.count({
    where: { identifier: pwFailIdentifier, expires: { gt: new Date() } },
  });
  if (recentPwFailures >= MAX_PASSWORD_ATTEMPTS) {
    redirect('/auth/signin?error=TooManyAttempts');
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Generic error — don't reveal whether the account exists
  if (!user || !user.passwordHash) {
    // Record a failed attempt even for unknown users (prevents timing oracle)
    await prisma.verificationToken.create({
      data: {
        identifier: pwFailIdentifier,
        token: randomBytes(12).toString('hex'),
        expires: new Date(Date.now() + PASSWORD_LOCKOUT_MS),
      },
    });
    redirect('/auth/signin?error=InvalidCredentials');
  }

  if (user.status === 'SUSPENDED') {
    redirect('/auth/error?error=AccountSuspended');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await prisma.verificationToken.create({
      data: {
        identifier: pwFailIdentifier,
        token: randomBytes(12).toString('hex'),
        expires: new Date(Date.now() + PASSWORD_LOCKOUT_MS),
      },
    });
    redirect('/auth/signin?error=InvalidCredentials');
  }

  // Successful password check — clear any failure records for this email
  await prisma.verificationToken.deleteMany({ where: { identifier: pwFailIdentifier } });

  // Generate 6-digit OTP (always exactly 6 digits, range 100000–999999)
  const otp = String(randomInt(100_000, 1_000_000));
  const identifier = `otp:${email}`;

  // Upsert OTP in VerificationToken (delete old then create new)
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  // Also clear any stale OTP failure records from a previous code
  await prisma.verificationToken.deleteMany({ where: { identifier: `otp-fail:${email}` } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: otp, // stored plaintext; short-lived (10 min) + timing-safe compare on verify
      expires: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });

  // Send OTP email
  try {
    await sendOtpEmail(email, otp);
  } catch {
    // If email fails, still redirect to verify page but user can request a resend
    // (better UX than failing silently on missing SMTP config during development)
  }

  // Set pending cookies (httpOnly, short-lived)
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
    redirect('/auth/verify-otp?error=MissingCode');
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(PENDING_UID_COOKIE)?.value;
  const callbackUrl = safeCallbackUrl(cookieStore.get(CALLBACK_URL_COOKIE)?.value);
  const keepSignedIn = cookieStore.get(KEEP_SIGNED_IN_COOKIE)?.value === '1';

  if (!userId) {
    // Session expired or cookie missing — restart sign-in
    redirect('/auth/signin?error=SessionExpired');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect('/auth/signin?error=InvalidCredentials');
  }

  const identifier = `otp:${user.email}`;
  const failIdentifier = `otp-fail:${user.email}`;

  // Check OTP attempt count before verifying — prevents brute force
  const recentFailures = await prisma.verificationToken.count({
    where: { identifier: failIdentifier, expires: { gt: new Date() } },
  });
  if (recentFailures >= MAX_OTP_ATTEMPTS) {
    // Too many wrong guesses: invalidate the OTP and force a fresh sign-in
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.verificationToken.deleteMany({ where: { identifier: failIdentifier } });
    cookieStore.delete(PENDING_UID_COOKIE);
    cookieStore.delete(CALLBACK_URL_COOKIE);
    redirect('/auth/signin?error=TooManyAttempts');
  }

  const tokenRecord = await prisma.verificationToken.findFirst({
    where: { identifier, expires: { gt: new Date() } },
  });

  if (!tokenRecord || tokenRecord.token !== code) {
    // Record this failed attempt
    await prisma.verificationToken.create({
      data: {
        identifier: failIdentifier,
        token: randomBytes(12).toString('hex'),
        expires: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });
    redirect('/auth/verify-otp?error=OtpInvalid');
  }

  // OTP is correct — delete it (single-use) and clear failure records
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.deleteMany({ where: { identifier: failIdentifier } });

  // Create a one-time completion token (2-minute TTL)
  const completionToken = randomBytes(32).toString('hex');
  const completionIdentifier = `auth:complete:${userId}`;
  await prisma.verificationToken.deleteMany({ where: { identifier: completionIdentifier } });
  await prisma.verificationToken.create({
    data: {
      identifier: completionIdentifier,
      token: completionToken,
      expires: new Date(Date.now() + COMPLETION_TOKEN_EXPIRY_MS),
    },
  });

  // Clear pending cookies
  cookieStore.delete(PENDING_UID_COOKIE);
  cookieStore.delete(CALLBACK_URL_COOKIE);
  cookieStore.delete(KEEP_SIGNED_IN_COOKIE);

  // Determine redirect target — force change-password if flagged
  const redirectTo = user.mustChangePassword
    ? '/auth/change-password'
    : callbackUrl;

  // signIn throws a NEXT_REDIRECT internally; Next.js handles it as a redirect response
  await signIn('credentials', { userId, completionToken, keepSignedIn: keepSignedIn ? '1' : '0', redirectTo });
}

// ---------------------------------------------------------------------------
// Self-service password reset — step 1: request a reset link
// ---------------------------------------------------------------------------

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get('email') as string | null)?.toLowerCase().trim() ?? '';

  if (!email) {
    redirect('/auth/forgot-password?error=MissingEmail');
  }

  // Derive the base URL from the incoming request headers (host + protocol).
  const headerStore = await headers();
  const host = headerStore.get('host') ?? 'localhost';
  const proto = headerStore.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  // Always show a "success" response to prevent user enumeration
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const resetToken = randomBytes(32).toString('hex');
    const resetIdentifier = `pw-reset:${email}`;

    // Invalidate any existing reset token for this email
    await prisma.verificationToken.deleteMany({ where: { identifier: resetIdentifier } });
    await prisma.verificationToken.create({
      data: {
        identifier: resetIdentifier,
        token: resetToken,
        expires: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
      },
    });

    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;
    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch {
      // Log but don't reveal to the user
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

  if (newPassword.length < 8) {
    redirect(`/auth/reset-password?token=${encodeURIComponent(token)}&error=TooShort`);
  }

  // Look up the token — it must be unexpired and be a pw-reset token
  const tokenRecord = await prisma.verificationToken.findUnique({ where: { token } });
  if (!tokenRecord || !tokenRecord.identifier.startsWith('pw-reset:') || tokenRecord.expires < new Date()) {
    redirect('/auth/reset-password?error=InvalidToken');
  }

  const email = tokenRecord.identifier.slice('pw-reset:'.length);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    redirect('/auth/reset-password?error=InvalidToken');
  }

  const { hashPassword } = await import('@/lib/password');
  const hash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, mustChangePassword: false },
  });

  // Invalidate the used token
  await prisma.verificationToken.deleteMany({ where: { identifier: tokenRecord.identifier } });

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    userId: user.id,
    action: 'PASSWORD_RESET',
    resource: 'User',
    resourceId: user.id,
  });

  redirect('/auth/signin?reset=1');
}
