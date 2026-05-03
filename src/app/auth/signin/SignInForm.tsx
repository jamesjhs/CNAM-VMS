'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { submitPassword } from '../actions';
import TurnstileWidget from '@/components/TurnstileWidget';
import { isTurnstileEnabled, TURNSTILE_SITE_KEY } from '@/lib/turnstile';

interface SignInFormProps {
  callbackUrl?: string;
  error?: string;
  reset?: boolean;
}

export default function SignInForm({ callbackUrl, error, reset }: SignInFormProps) {
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');

  useEffect(() => {
    console.log('[SignIn] Component mounted — isTurnstileEnabled=' + isTurnstileEnabled + ', SITE_KEY=' + (TURNSTILE_SITE_KEY ? TURNSTILE_SITE_KEY.substring(0, 8) + '...' : 'undefined'));
  }, []);

  const errorMessages: Record<string, string> = {
    InvalidCredentials: 'Incorrect email address or password. Please try again.',
    MissingFields: 'Please enter your email address and password.',
    SessionExpired: 'Your sign-in session expired. Please try again.',
    OAuthAccountNotLinked: 'This email is already associated with another account.',
    TooManyAttempts: 'Too many failed sign-in attempts. Please try again.',
    TurnstileVerificationFailed: 'Security verification failed. Please try the CAPTCHA again.',
    SubmissionError: 'Something went wrong submitting the form. Please try again.',
  };
  const errorMsg = submitError || (error ? (errorMessages[error] ?? 'Something went wrong. Please try again.') : null);

  const handleTokenChange = (token: string) => {
    console.log(`[SignIn] Turnstile token received: ${token.length > 0 ? `${token.length} chars` : 'EMPTY'}`);
    if (token.length > 0) {
      console.log(`[SignIn] Token first 20 chars: ${token.substring(0, 20)}...`);
    }
    setTurnstileToken(token);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError('');
    
    console.log(`[SignIn] Form submitted — isTurnstileEnabled=${isTurnstileEnabled}, tokenLength=${turnstileToken.length}`);
    
    // Check Turnstile if enabled
    if (isTurnstileEnabled) {
      if (!turnstileToken) {
        console.warn('[SignIn] Form submitted but Turnstile token is empty! Widget may have failed.');
        setSubmitError('Please complete the security verification below.');
        return;
      }
      console.log('[SignIn] Turnstile token verified, proceeding with password submission...');
    }

    console.log('[SignIn] Form submitted, starting authentication...');
    setIsSubmitting(true);

    // Wrap the server action in error handling
    try {
      const formData = new FormData(e.currentTarget);
      // Manually add Turnstile token to FormData
      if (isTurnstileEnabled) {
        formData.set('turnstileToken', turnstileToken);
        console.log('[SignIn] Added Turnstile token to FormData');
      }
      const email = formData.get('email');
      console.log(`[SignIn] Submitting password for @${String(email).split('@')[1] || 'unknown'}...`);
      console.log(`[SignIn] Turnstile token included: ${turnstileToken ? 'yes' : 'no'}`);
      await submitPassword(formData);
    } catch (err) {
      setIsSubmitting(false);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[SignIn] Submission error:', err);
      
      // Rethrow NEXT_REDIRECT so Next.js can process redirects
      if (errorMessage.includes('NEXT_REDIRECT')) {
        console.log('[SignIn] NEXT_REDIRECT caught — authentication successful, processing redirect');
        throw err;
      }
      
      // Show generic error for other failures
      console.error('[SignIn] Login failed:', errorMessage);
      setSubmitError('Failed to sign in. Please check your email and password and try again.');
    }
  };

  useEffect(() => {
    // Reset submit error when component updates
    setIsSubmitting(false);
  }, [error]);

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? '/dashboard'} />

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {errorMsg}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:border-transparent"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <Link href="/auth/forgot-password" className="text-xs text-[#1a3a5c] hover:underline">
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:border-transparent"
          placeholder="••••••••"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="keepSignedIn"
          name="keepSignedIn"
          type="checkbox"
          value="1"
          className="h-4 w-4 rounded border-gray-300 text-[#1a3a5c] focus:ring-[#1a3a5c]"
        />
        <label htmlFor="keepSignedIn" className="text-sm text-gray-600">
          Keep me signed in for 7 days
        </label>
      </div>

      {isTurnstileEnabled && TURNSTILE_SITE_KEY && (
        <div className="pt-2">
          <div className="text-xs text-gray-500 mb-2">
            ✓ Verification ready {turnstileToken ? '(completed)' : '(pending)'}
          </div>
          <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={handleTokenChange} />
        </div>
      )}
      {!TURNSTILE_SITE_KEY && isTurnstileEnabled && (
        <div className="text-xs text-red-600 mb-2">
          ⚠️ Turnstile enabled but SITE_KEY is undefined (was it set before build?)
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || (isTurnstileEnabled && !turnstileToken)}
        className="w-full bg-[#1a3a5c] hover:bg-[#2d5986] disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
      >
        {isSubmitting ? 'Signing in...' : isTurnstileEnabled && !turnstileToken ? 'Complete verification →' : 'Continue →'}
      </button>
    </form>
  );
}
