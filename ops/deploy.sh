#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/var/node/cnamvms.jahosi.co.uk-3001"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"
RELEASES_TO_KEEP="${RELEASES_TO_KEEP:-5}"

usage() {
  echo "Usage: $0 /absolute/path/to/artifact.tar.gz"
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

ARTIFACT_PATH="$1"
if [[ ! -f "$ARTIFACT_PATH" ]]; then
  echo "Artifact not found: $ARTIFACT_PATH"
  exit 1
fi

mkdir -p "$RELEASES_DIR" "$SHARED_DIR/data" "$SHARED_DIR/uploads" "$SHARED_DIR/logs"

if [[ ! -f "$SHARED_DIR/.env" ]]; then
  echo "Missing required environment file: $SHARED_DIR/.env"
  echo "Create it from .env.example and follow docs/deployment.md before deploying."
  exit 1
fi

RELEASE_ID="$(date -u +%Y%m%d%H%M%S)"
NEW_RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
mkdir -p "$NEW_RELEASE_DIR"

echo "Extracting artifact into $NEW_RELEASE_DIR"
tar -xzf "$ARTIFACT_PATH" -C "$NEW_RELEASE_DIR"

ln -sfn "$SHARED_DIR/.env" "$NEW_RELEASE_DIR/.env"
ln -sfn "$SHARED_DIR/uploads" "$NEW_RELEASE_DIR/uploads"

TMP_LINK="$APP_ROOT/.current_tmp"
ln -sfn "$NEW_RELEASE_DIR" "$TMP_LINK"
mv -Tf "$TMP_LINK" "$CURRENT_LINK"

cd "$CURRENT_LINK"
if pm2 describe cnam-vms >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs --update-env
fi
pm2 save

for _ in {1..20}; do
  if curl -fsS --max-time 3 "http://127.0.0.1:3001/" >/dev/null; then
    echo "Health check passed"
    break
  fi
  sleep 2
done

if ! curl -fsS --max-time 3 "http://127.0.0.1:3001/" >/dev/null; then
  echo "Health check failed after deploy"
  exit 1
fi

if [[ "$RELEASES_TO_KEEP" =~ ^[1-9][0-9]*$ ]]; then
  mapfile -t RELEASE_LIST < <(ls -1dt "$RELEASES_DIR"/* 2>/dev/null || true)
  if (( ${#RELEASE_LIST[@]} > RELEASES_TO_KEEP )); then
    for OLD_RELEASE in "${RELEASE_LIST[@]:RELEASES_TO_KEEP}"; do
      rm -rf "$OLD_RELEASE"
    done
  fi
else
  echo "Skipping release cleanup because RELEASES_TO_KEEP is not a positive integer: $RELEASES_TO_KEEP"
fi

echo "Deployment complete: $RELEASE_ID"
