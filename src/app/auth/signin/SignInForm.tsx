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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setSubmitError('');
    
    // Check Turnstile if enabled
    if (isTurnstileEnabled) {
      if (!turnstileToken) {
        e.preventDefault();
        setSubmitError('Please complete the security verification below.');
        return;
      }
    }

    setIsSubmitting(true);

    // Wrap the server action in error handling
    try {
      const formData = new FormData(e.currentTarget);
      await submitPassword(formData);
    } catch (err) {
      setIsSubmitting(false);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('[SignIn] Submission error:', err);
      
      // Only show generic error if it's not a redirect error
      if (!errorMessage.includes('NEXT_REDIRECT')) {
        setSubmitError('Failed to sign in. Please check your email and password and try again.');
      }
    }
  };

  useEffect(() => {
    // Reset submit error when component updates
    setIsSubmitting(false);
  }, [error]);

  return (
    <form action={submitPassword} className="space-y-4" onSubmit={handleSubmit}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? '/dashboard'} />
      {isTurnstileEnabled && <input type="hidden" name="turnstileToken" value={turnstileToken} />}

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
          <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onTokenChange={setTurnstileToken} />
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-[#1a3a5c] hover:bg-[#2d5986] disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
      >
        {isSubmitting ? 'Signing in...' : 'Continue →'}
      </button>
    </form>
  );
}
