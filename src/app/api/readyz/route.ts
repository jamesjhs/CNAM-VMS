import { APP_VERSION } from '@/lib/version';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    // Verify database connectivity
    const db = getDb();
    db.prepare('SELECT 1').get();

    return Response.json({
      ok: true,
      service: 'CNAM VMS',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    console.error('[readyz] Database connectivity check failed:', error);
    return Response.json(
      {
        ok: false,
        service: 'CNAM VMS',
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        database: 'error',
      },
      { status: 503 }
    );
  }
}
