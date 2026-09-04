#!/usr/bin/env bash
# Renders build/icon.svg to the 1024x1024 build/icon.png electron-builder turns
# into the macOS .icns.
#
# Uses headless Chrome rather than a rasterizer dependency: the icon changes
# about never, and node_modules ships inside the packaged app, so a 30MB native
# image library would ride along for an asset generated once.
#
# macOS only. Adjust CHROME if yours lives elsewhere.
set -euo pipefail

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at: $CHROME" >&2
  echo "Set CHROME=/path/to/chrome and re-run." >&2
  exit 1
fi

"$CHROME" --headless --disable-gpu --no-sandbox \
  --screenshot="$DIR/icon.png" \
  --window-size=1024,1024 \
  --default-background-color=00000000 \
  --hide-scrollbars \
  "file://$DIR/icon.svg" 2>/dev/null

echo "wrote $DIR/icon.png"
