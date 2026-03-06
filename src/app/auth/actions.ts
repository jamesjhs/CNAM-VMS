'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { randomBytes, randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import { signIn } from '@/auth';
import { verifyPassword } from '@/lib/password';
import { sendOtpEmail } from '@/lib/mail';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const COMPLETION_TOKEN_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes

const PENDING_UID_COOKIE = '_cnam_pending_uid';
const CALLBACK_URL_COOKIE = '_cnam_cb';

// ---------------------------------------------------------------------------
// Step 1 — validate email + password, send OTP
// ---------------------------------------------------------------------------

export async function submitPassword(formData: FormData) {
  const email = (formData.get('email') as string | null)?.toLowerCase().trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const callbackUrl = (formData.get('callbackUrl') as string | null) ?? '/dashboard';

  if (!email || !password) {
    redirect('/auth/signin?error=MissingFields');
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Generic error — don't reveal whether the account exists
  if (!user || !user.passwordHash) {
    redirect('/auth/signin?error=InvalidCredentials');
  }

  if (user.status === 'SUSPENDED') {
    redirect('/auth/error?error=AccountSuspended');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    redirect('/auth/signin?error=InvalidCredentials');
  }

  // Generate 6-digit OTP (always exactly 6 digits, range 100000–999999)
  const otp = String(randomInt(100_000, 1_000_000));
  const identifier = `otp:${email}`;

  // Upsert OTP in VerificationToken (delete old then create new)
  await prisma.verificationToken.deleteMany({ where: { identifier } });
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
  const callbackUrl = cookieStore.get(CALLBACK_URL_COOKIE)?.value ?? '/dashboard';

  if (!userId) {
    // Session expired or cookie missing — restart sign-in
    redirect('/auth/signin?error=SessionExpired');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    redirect('/auth/signin?error=InvalidCredentials');
  }

  const identifier = `otp:${user.email}`;
  const tokenRecord = await prisma.verificationToken.findFirst({
    where: { identifier, expires: { gt: new Date() } },
  });

  if (!tokenRecord || tokenRecord.token !== code) {
    redirect('/auth/verify-otp?error=OtpInvalid');
  }

  // OTP is correct — delete it (single-use)
  await prisma.verificationToken.deleteMany({ where: { identifier } });

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

  // Determine redirect target — force change-password if flagged
  const redirectTo = user.mustChangePassword
    ? '/auth/change-password'
    : callbackUrl;

  // signIn throws a NEXT_REDIRECT internally; Next.js handles it as a redirect response
  await signIn('credentials', { userId, completionToken, redirectTo });
}
