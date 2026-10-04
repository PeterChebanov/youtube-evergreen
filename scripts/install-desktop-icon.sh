#!/usr/bin/env bash
# Copies Evergreen Studio.app to ~/Desktop with the correct project path baked in.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${ROOT}/scripts/macos/Evergreen Studio.app"
DEST="${HOME}/Desktop/Evergreen Studio.app"

if [[ ! -d "$SRC" ]]; then
  echo "Missing template: $SRC" >&2
  exit 1
fi

rm -rf "$DEST"
ditto "$SRC" "$DEST"
chmod +x "${DEST}/Contents/MacOS/Evergreen Studio"
/usr/bin/sed -i '' "s|__PROJECT_ROOT__|${ROOT}|g" "${DEST}/Contents/MacOS/Evergreen Studio"
xattr -cr "$DEST" 2>/dev/null || true

echo "Installed: ${DEST}"
echo "Double-click “Evergreen Studio” on your Desktop to open the app."
echo "Logs: ~/Library/Logs/Evergreen Studio.log"
