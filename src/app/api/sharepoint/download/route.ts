import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import type { SessionUser } from '@/lib/auth-helpers';
import { getSharePointConfig, downloadItem, sanitizeSharePointFilename } from '@/lib/sharepoint';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.capabilities?.includes('files:sharepoint.read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const itemId = request.nextUrl.searchParams.get('itemId');
  if (!itemId) {
    return NextResponse.json({ error: 'Missing itemId parameter' }, { status: 400 });
  }

  const config = getSharePointConfig();
  if (!config) {
    return NextResponse.json({ error: 'SharePoint is not configured' }, { status: 503 });
  }

  try {
    const { buffer, filename, mimeType } = await downloadItem(config, itemId);

    // Sanitise filename for Content-Disposition header
    const safeFilename = sanitizeSharePointFilename(filename);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[SharePoint] Download error:', err);
    return NextResponse.json(
      { error: 'Failed to download file from SharePoint' },
      { status: 502 },
    );
  }
}
