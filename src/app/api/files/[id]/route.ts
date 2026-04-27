import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/lib/db';
import { safeUploadPath } from '@/lib/uploads';
import type { SessionUser } from '@/lib/auth-helpers';
import fs from 'fs/promises';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const db = getDb();
  type FileRow = { filename: string; originalName: string; mimeType: string };
  const file = db.prepare('SELECT filename, originalName, mimeType FROM file_assets WHERE id = ?').get(id) as FileRow | undefined;
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  let filePath: string;
  try {
    filePath = safeUploadPath(file.filename);
  } catch {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  const safeOriginalName = file.originalName.replace(/[^a-zA-Z0-9._\- ]/g, '_');

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${safeOriginalName}"; filename*=UTF-8''${encodeURIComponent(safeOriginalName)}`,
      'Content-Length': String(fileBuffer.length),
      'Cache-Control': 'no-store',
    },
  });
}
