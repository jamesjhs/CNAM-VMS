import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user as { mustChangePassword?: boolean } | undefined;

  // If the user is logged in with a mandatory password change, redirect them
  // to the change-password page for any route that isn't already an auth page.
  if (
    user?.mustChangePassword &&
    !pathname.startsWith('/auth/') &&
    !pathname.startsWith('/api/')
  ) {
    return NextResponse.redirect(new URL('/auth/change-password', req.url));
  }
});

export const config = {
  // Exclude static files and Next.js internals; match all real routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
