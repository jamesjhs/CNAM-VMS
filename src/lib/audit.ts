import { createId } from '@paralleldrive/cuid2';
import { getDb, now } from '@/lib/db';

interface AuditLogEntry {
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO audit_logs (id, userId, action, resource, resourceId, detail, ipAddress, userAgent, createdAt)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(
      createId(),
      entry.userId ?? null,
      entry.action,
      entry.resource ?? null,
      entry.resourceId ?? null,
      entry.detail ? JSON.stringify(entry.detail) : null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
      now(),
    );
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}
