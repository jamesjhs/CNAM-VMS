import { verifyTurnstileToken } from '@/lib/turnstile';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token: string };
    const { token } = body;

    if (!token) {
      return Response.json({ success: false, error: 'No token provided' }, { status: 400 });
    }

    const isValid = await verifyTurnstileToken(token);
    return Response.json({ success: isValid });
  } catch (error) {
    console.error('[Turnstile API] Error:', error);
    return Response.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
