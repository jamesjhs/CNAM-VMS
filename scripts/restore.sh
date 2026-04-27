#!/usr/bin/env bash
# CNAM-VMS Database & Upload Restore Script
set -euo pipefail

usage() {
  echo "Usage: $0 --db <db_backup.sqlite3> [--uploads <uploads_backup.tar.gz>]"
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

if [[ "${DATABASE_URL}" != file:* ]]; then
  echo "ERROR: DATABASE_URL must be a SQLite file URL (file:...)" >&2
  exit 1
fi

DB_PATH="${DATABASE_URL#file:}"
if [[ "${DB_PATH}" != /* ]]; then
  DB_PATH="$(pwd)/${DB_PATH}"
fi

# Restore database
echo "Restoring database from: ${DB_BACKUP}"
mkdir -p "$(dirname "${DB_PATH}")"
cp "${DB_BACKUP}" "${DB_PATH}"

# Restore WAL/SHM files when present in backup set
[ -f "${DB_BACKUP}-wal" ] && cp "${DB_BACKUP}-wal" "${DB_PATH}-wal" || true
[ -f "${DB_BACKUP}-shm" ] && cp "${DB_BACKUP}-shm" "${DB_PATH}-shm" || true

echo "Database restore complete."

# Restore uploads
if [ -n "${UPLOAD_BACKUP}" ]; then
  echo "Restoring uploads from: ${UPLOAD_BACKUP}"
  mkdir -p "${UPLOAD_DIR}"
  tar -xzf "${UPLOAD_BACKUP}" -C "$(dirname "${UPLOAD_DIR}")"
  echo "Upload restore complete."
fi

echo "=== Restore complete ==="
