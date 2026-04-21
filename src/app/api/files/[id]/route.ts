import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
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

  const file = await prisma.fileAsset.findUnique({ where: { id } });
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

  return new NextResponse(fileBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${safeOriginalName}"; filename*=UTF-8''${encodeURIComponent(safeOriginalName)}`,
      'Content-Length': String(fileBuffer.length),
      'Cache-Control': 'no-store',
    },
  });
}
