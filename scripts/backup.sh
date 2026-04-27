#!/usr/bin/env bash
# CNAM-VMS SQLite Database & Upload Backup Script
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/cnam-vms}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/uploads/cnam-vms}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "=== CNAM-VMS Backup ==="
echo "Timestamp: ${TIMESTAMP}"

mkdir -p "${BACKUP_DIR}"

# ── Database backup ────────────────────────────────────────────────────────
#
# Resolve the SQLite file path from DATABASE_URL (format: file:./path/to/db)
# Falls back to ./data/cnam-vms.db relative to the app root.
RAW_DB_URL="${DATABASE_URL:-file:./data/cnam-vms.db}"
DB_RELATIVE="${RAW_DB_URL#file:}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="$(cd "${SCRIPT_DIR}" && realpath "${DB_RELATIVE}" 2>/dev/null || echo "${SCRIPT_DIR}/${DB_RELATIVE#./}")"

if [ ! -f "${DB_PATH}" ]; then
  echo "ERROR: Database file not found: ${DB_PATH}" >&2
  exit 1
fi

DB_BACKUP="${BACKUP_DIR}/db_${TIMESTAMP}.sqlite3"
echo "Backing up SQLite database: ${DB_PATH}"

# Use SQLite's online backup API via the sqlite3 CLI (if available),
# falling back to a direct file copy when sqlite3 is not installed.
# The online backup is safe even while the app is running (WAL mode).
if command -v sqlite3 &>/dev/null; then
  sqlite3 "${DB_PATH}" ".backup '${DB_BACKUP}'"
else
  cp "${DB_PATH}" "${DB_BACKUP}"
fi
echo "Database backup: ${DB_BACKUP}"

# ── Upload directory backup ────────────────────────────────────────────────
UPLOAD_BACKUP="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
if [ -d "${UPLOAD_DIR}" ]; then
  echo "Backing up uploads..."
  tar -czf "${UPLOAD_BACKUP}" -C "$(dirname "${UPLOAD_DIR}")" "$(basename "${UPLOAD_DIR}")"
  echo "Upload backup: ${UPLOAD_BACKUP}"
else
  echo "Upload directory not found, skipping: ${UPLOAD_DIR}"
fi

# ── Prune old backups (keep last 30 days) ─────────────────────────────────
echo "Pruning backups older than 30 days..."
find "${BACKUP_DIR}" -name "*.sqlite3" -mtime +30 -delete
find "${BACKUP_DIR}" -name "*.tar.gz" -mtime +30 -delete

echo "=== Backup complete ==="
