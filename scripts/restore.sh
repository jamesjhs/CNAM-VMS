#!/usr/bin/env bash
# CNAM-VMS Database & Upload Restore Script
set -euo pipefail

usage() {
  echo "Usage: $0 --db <db_backup.dump> [--uploads <uploads_backup.tar.gz>]"
  exit 1
}

DB_BACKUP=""
UPLOAD_BACKUP=""
UPLOAD_DIR="${UPLOAD_DIR:-/var/uploads/cnam-vms}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db) DB_BACKUP="$2"; shift 2 ;;
    --uploads) UPLOAD_BACKUP="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[ -z "${DB_BACKUP}" ] && usage

echo "=== CNAM-VMS Restore ==="

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

# Restore database
echo "Restoring database from: ${DB_BACKUP}"
pg_restore --dbname="${DATABASE_URL}" --clean --no-privileges --no-owner --format=custom "${DB_BACKUP}"
echo "Database restore complete."

# Restore uploads
if [ -n "${UPLOAD_BACKUP}" ]; then
  echo "Restoring uploads from: ${UPLOAD_BACKUP}"
  mkdir -p "${UPLOAD_DIR}"
  tar -xzf "${UPLOAD_BACKUP}" -C "$(dirname "${UPLOAD_DIR}")"
  echo "Upload restore complete."
fi

echo "=== Restore complete ==="
