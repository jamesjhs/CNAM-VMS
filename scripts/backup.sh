#!/usr/bin/env bash
# CNAM-VMS Database & Upload Backup Script
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/cnam-vms}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/uploads/cnam-vms}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_BACKUP="${BACKUP_DIR}/db_${TIMESTAMP}.dump"
UPLOAD_BACKUP="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"

echo "=== CNAM-VMS Backup ==="
echo "Timestamp: ${TIMESTAMP}"

mkdir -p "${BACKUP_DIR}"

# Database backup
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

echo "Backing up database..."
pg_dump "${DATABASE_URL}" --format=custom --no-password --file="${DB_BACKUP}"
echo "Database backup: ${DB_BACKUP}"

# Upload directory backup
if [ -d "${UPLOAD_DIR}" ]; then
  echo "Backing up uploads..."
  tar -czf "${UPLOAD_BACKUP}" -C "$(dirname "${UPLOAD_DIR}")" "$(basename "${UPLOAD_DIR}")"
  echo "Upload backup: ${UPLOAD_BACKUP}"
else
  echo "Upload directory not found, skipping: ${UPLOAD_DIR}"
fi

# Prune old backups (keep last 30 days)
echo "Pruning backups older than 30 days..."
find "${BACKUP_DIR}" -name "*.dump" -mtime +30 -delete
find "${BACKUP_DIR}" -name "*.tar.gz" -mtime +30 -delete

echo "=== Backup complete ==="
