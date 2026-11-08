#!/usr/bin/env bash
set -euo pipefail

# Simple test helper for the Puppeteer scraper
# Usage: ./test-run.sh [URL]

URL=${1:-"https://www.nytimes.com/"}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
NODE=$(which node || true)
if [ -z "$NODE" ]; then
  echo "Node.js not found in PATH. Install Node and try again." >&2
  exit 2
fi

echo "Running fetch-article.js against: $URL"
if command -v jq >/dev/null 2>&1; then
  node "$SCRIPT_DIR/fetch-article.js" "$URL" | jq .
else
  node "$SCRIPT_DIR/fetch-article.js" "$URL"
fi
