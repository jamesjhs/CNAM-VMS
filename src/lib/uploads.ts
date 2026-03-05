import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
const MAX_SIZE_MB = Number(process.env.UPLOAD_MAX_SIZE_MB ?? 10);
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES: Set<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const ALLOWED_EXTENSIONS: Set<string> = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.txt', '.csv', '.docx', '.xlsx',
]);

export interface UploadResult {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
}

export interface UploadError {
  error: string;
}

/**
 * Ensure the upload directory exists.
 */
export function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Safely resolve upload path, preventing directory traversal.
 */
export function safeUploadPath(filename: string): string {
  const resolved = path.resolve(UPLOAD_DIR, filename);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
    throw new Error('Path traversal attempt detected');
  }
  return resolved;
}

/**
 * Generate a unique filename to avoid collisions.
 */
export function generateFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const randomHex = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${randomHex}${ext}`;
}

/**
 * Validate a file for upload.
 */
export function validateFile(
  originalName: string,
  mimeType: string,
  size: number,
): string | null {
  if (size > MAX_SIZE_BYTES) {
    return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`;
  }

  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `File type not allowed. Allowed extensions: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`;
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return `MIME type not allowed: ${mimeType}`;
  }

  return null;
}

/**
 * Save a Buffer to the upload directory.
 */
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> {
  ensureUploadDir();

  const filename = generateFilename(originalName);
  const filePath = safeUploadPath(filename);

  await fs.promises.writeFile(filePath, buffer);

  return {
    filename,
    originalName,
    mimeType,
    size: buffer.length,
    path: filePath,
  };
}
