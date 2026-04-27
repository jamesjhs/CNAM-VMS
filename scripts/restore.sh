#!/usr/bin/env bash
# CNAM-VMS SQLite Database & Upload Restore Script
set -euo pipefail

usage() {
  echo "Usage: $0 --db <db_backup.sqlite3> [--uploads <uploads_backup.tar.gz>]"
  echo ""
  echo "Options:"
  echo "  --db        Path to the SQLite backup file (.sqlite3)"
  echo "  --uploads   Path to the uploads tar.gz archive (optional)"
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

# ── Resolve destination database path ────────────────────────────────────
RAW_DB_URL="${DATABASE_URL:-file:./data/cnam-vms.db}"
DB_RELATIVE="${RAW_DB_URL#file:}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DB="$(cd "${SCRIPT_DIR}" && realpath "${DB_RELATIVE}" 2>/dev/null || echo "${SCRIPT_DIR}/${DB_RELATIVE#./}")"

echo "Destination database: ${DEST_DB}"

# Safety: stop the app before restoring the database file.
echo ""
echo "⚠  Make sure the CNAM-VMS application is stopped before restoring."
echo "   (e.g. run: pm2 stop cnam-vms)"
echo ""
read -r -p "Continue with restore? [y/N] " confirm
[[ "${confirm,,}" == "y" ]] || { echo "Aborted."; exit 0; }

# ── Restore database ───────────────────────────────────────────────────────
echo "Restoring database from: ${DB_BACKUP}"
mkdir -p "$(dirname "${DEST_DB}")"
cp "${DB_BACKUP}" "${DEST_DB}"
echo "Database restore complete."

# ── Restore uploads ────────────────────────────────────────────────────────
if [ -n "${UPLOAD_BACKUP}" ]; then
  echo "Restoring uploads from: ${UPLOAD_BACKUP}"
  mkdir -p "${UPLOAD_DIR}"
  tar -xzf "${UPLOAD_BACKUP}" -C "$(dirname "${UPLOAD_DIR}")"
  echo "Upload restore complete."
fi

echo ""
echo "=== Restore complete ==="
echo "Restart the app when ready: pm2 start cnam-vms"
