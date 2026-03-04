import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { saveFile, validateFile } from '@/lib/uploads';
import { logAudit } from '@/lib/audit';
import type { SessionUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!user.capabilities?.includes('admin:files.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
