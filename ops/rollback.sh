#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/var/node/cnamvms.jahosi.co.uk-3001"
RELEASES_DIR="$APP_ROOT/releases"
CURRENT_LINK="$APP_ROOT/current"

if [[ ! -d "$RELEASES_DIR" ]]; then
  echo "No releases found at $RELEASES_DIR"
  exit 1
fi

mapfile -t RELEASE_PATHS < <(ls -1dt "$RELEASES_DIR"/* 2>/dev/null || true)
if (( ${#RELEASE_PATHS[@]} == 0 )); then
  echo "No releases available"
  exit 1
fi

echo "Available releases:"
for rel in "${RELEASE_PATHS[@]}"; do
  echo "- $(basename "$rel")"
done

TARGET_RELEASE="${1:-}"
if [[ -z "$TARGET_RELEASE" ]]; then
  CURRENT_TARGET=""
  if [[ -L "$CURRENT_LINK" ]]; then
    CURRENT_TARGET="$(readlink -f "$CURRENT_LINK")"
  fi

  for rel in "${RELEASE_PATHS[@]}"; do
    if [[ "$rel" != "$CURRENT_TARGET" ]]; then
      TARGET_RELEASE="$(basename "$rel")"
      break
    fi
  done
fi

if [[ -z "$TARGET_RELEASE" ]]; then
  echo "Unable to determine rollback target automatically."
  echo "This usually means only one release exists or all releases match current."
  echo "Select a target manually from the list above: $0 <release-id>"
  exit 1
fi

TARGET_PATH="$RELEASES_DIR/$TARGET_RELEASE"
if [[ ! -d "$TARGET_PATH" ]]; then
  echo "Target release does not exist: $TARGET_RELEASE"
  exit 1
fi

TMP_LINK="$APP_ROOT/.current_tmp"
ln -sfn "$TARGET_PATH" "$TMP_LINK"
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
  echo "Health check failed after rollback"
  exit 1
fi

echo "Rollback complete: $TARGET_RELEASE"
