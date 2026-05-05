import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import type { SessionUser } from '@/lib/auth-helpers';
import { getSharePointConfig, uploadFile, sanitizeFolderPath } from '@/lib/sharepoint';
import { validateFile } from '@/lib/uploads';
import { logAudit } from '@/lib/audit';

// Simple in-memory rate limiter — max 10 uploads per user per minute
const uploadAttempts = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1_000;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = uploadAttempts.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Also clean up any other stale entries to prevent unbounded growth
    for (const [key, val] of uploadAttempts) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) uploadAttempts.delete(key);
    }
    uploadAttempts.set(userId, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.capabilities?.includes('files:sharepoint.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait before trying again.' },
      { status: 429 },
    );
  }

  const config = getSharePointConfig();
  if (!config) {
    return NextResponse.json({ error: 'SharePoint is not configured' }, { status: 503 });
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

  const rawFolderPath = ((formData.get('folderPath') as string | null) ?? '').trim();
  let folderPath: string;
  try {
    folderPath = sanitizeFolderPath(rawFolderPath);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid folder path' },
      { status: 400 },
    );
  }

  const originalName = file instanceof File ? file.name : 'upload';
  const mimeType = file.type || 'application/octet-stream';
  const buffer = Buffer.from(await file.arrayBuffer());

  const validationError = validateFile(originalName, mimeType, buffer.length, buffer);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const item = await uploadFile(config, folderPath, originalName, buffer);

    await logAudit({
      userId: user.id,
      action: 'SHAREPOINT_FILE_UPLOADED',
      resource: 'SharePointFile',
      resourceId: item.id,
      detail: { folderPath, name: item.name, size: buffer.length },
    });

    return NextResponse.json({
      id: item.id,
      name: item.name,
      size: item.size ?? buffer.length,
    });
  } catch (err) {
    console.error('[SharePoint] Upload error:', err);
    return NextResponse.json(
      { error: 'Failed to upload file to SharePoint' },
      { status: 502 },
    );
  }
}
