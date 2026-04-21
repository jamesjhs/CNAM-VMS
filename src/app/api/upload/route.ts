import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { saveFile, validateFile } from '@/lib/uploads';
import { logAudit } from '@/lib/audit';
import type { SessionUser } from '@/lib/auth-helpers';

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter — max 10 uploads per user per minute
// ---------------------------------------------------------------------------
const uploadAttempts = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = uploadAttempts.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    uploadAttempts.set(userId, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.capabilities?.includes('admin:files.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait before trying again.' },
      { status: 429 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const originalName = file instanceof File ? file.name : 'upload';
  const mimeType = file.type || 'application/octet-stream';
  const buffer = Buffer.from(await file.arrayBuffer());

  const validationError = validateFile(originalName, mimeType, buffer.length);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  let uploadResult;
  try {
    uploadResult = await saveFile(buffer, originalName, mimeType);
  } catch (err) {
    console.error('[Upload] Error saving file:', err);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }

  const fileAsset = await prisma.fileAsset.create({
    data: {
      filename: uploadResult.filename,
      originalName: uploadResult.originalName,
      mimeType: uploadResult.mimeType,
      size: uploadResult.size,
      path: uploadResult.path,
      uploadedBy: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'FILE_UPLOADED',
    resource: 'FileAsset',
    resourceId: fileAsset.id,
    detail: { filename: uploadResult.filename, originalName, size: uploadResult.size },
  });

  return NextResponse.json({
    id: fileAsset.id,
    filename: uploadResult.filename,
    originalName: uploadResult.originalName,
    size: uploadResult.size,
    mimeType: uploadResult.mimeType,
  });
}
